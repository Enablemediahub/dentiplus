import React from 'react';
import { PortalIcon } from './PortalIcon';

function formatCurrency(value) {
  return `GHS ${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getReceiptDentistLabel(receipt) {
  const rawName = String(receipt?.bill?.dentistName ?? '').trim();
  if (!rawName || rawName.toLowerCase() === 'reception desk') {
    return rawName || 'Reception desk';
  }

  if (receipt?.bill?.billType !== 'procedure_charge') {
    return rawName;
  }

  const cleaned = rawName
    .replace(/^dr\.?\s*\(dent\)\s*/i, '')
    .replace(/^dr\.?\s*/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return rawName;
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function normalizeDateOnly(value) {
  return String(value ?? '').slice(0, 10);
}

function inDateRange(value, startDate, endDate) {
  const dateValue = normalizeDateOnly(value);
  if (!dateValue) {
    return false;
  }

  if (startDate && dateValue < startDate) {
    return false;
  }

  if (endDate && dateValue > endDate) {
    return false;
  }

  return true;
}

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
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

function matchesHistorySearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.receiptNumber,
    item.bill,
    item.patientName,
    item.dentistName,
    item.chargeSummary,
    item.paymentMethod,
    item.status,
    item.totalAmountLabel,
    item.remainingAmountLabel,
  ].join(' ').toLowerCase().includes(trimmed);
}

function createExcelBlob(title, columns, rows) {
  const tableRows = rows.map((row) => `
    <tr>
      ${row.map((cell) => `<td>${String(cell ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}
    </tr>
  `).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
      </head>
      <body>
        <table>
          <thead>
            <tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>
          </thead>
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

  const head = columns.map((column) => `<th>${column}</th>`).join('');
  const body = rows.map((row) => `
    <tr>
      ${row.map((cell) => `<td>${String(cell ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}
    </tr>
  `).join('');
  const totalsMarkup = totals.map((line) => `<div class="totals-line"><span>${line.label}</span><strong>${line.value}</strong></div>`).join('');

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
          @media print { body { margin: 16px; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body || `<tr><td colspan="${columns.length}">No records in the selected range.</td></tr>`}</tbody>
        </table>
        <div class="totals">${totalsMarkup}</div>
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  popup.document.close();
}

function printThermalReceipt(receipt) {
  const popup = window.open('', '_blank', 'width=420,height=720');
  if (!popup) {
    return;
  }

  const dentistReceiptLabel = getReceiptDentistLabel(receipt);

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
          body { font-family: Arial, sans-serif; margin: 0; padding: 12px; color: #111; font-weight: 700; }
          .receipt { width: 302px; margin: 0 auto; }
          .center { text-align: center; }
          .title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
          .small { font-size: 12px; color: #111; font-weight: 700; }
          .section { border-top: 1px dashed #666; padding-top: 8px; margin-top: 8px; }
          .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
          .line { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; margin-bottom: 4px; font-weight: 700; }
          .totals { border-top: 1px dashed #666; margin-top: 10px; padding-top: 8px; }
          .strong { font-weight: 800; }
          .paid-hero { border: 2px solid #111; padding: 10px 8px; margin-top: 8px; text-align: center; }
          .paid-hero-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
          .paid-hero-value { font-size: 28px; line-height: 1; font-weight: 800; }
          .footer-note { margin-top: 12px; text-align: center; font-size: 12px; line-height: 1.4; }
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
            <div class="line"><span>Dentist</span><span>${dentistReceiptLabel}</span></div>
            <div class="paid-hero">
              <div class="paid-hero-label">Amount Paid</div>
              <div class="paid-hero-value">${receipt.totalPaidLabel}</div>
            </div>
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
          <div class="footer-note">
            <div>Thank you for choosing eDENTAL CLINICS.</div>
            <div>We appreciate your trust and wish you a healthy smile.</div>
            <div style="margin-top:6px;">Designed and Powered By: DALE QUIST [Enable Technologies]</div>
          </div>
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
      onClose(response?.bill ?? null, response?.message ?? 'Frontdesk bill created successfully.');
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

  const dentistReceiptLabel = getReceiptDentistLabel(receipt);

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
              <div className="receipt-preview-sheet__line"><span>Dentist</span><span>{dentistReceiptLabel}</span></div>
              <div
                style={{
                  border: '2px solid currentColor',
                  borderRadius: '12px',
                  padding: '12px 10px',
                  margin: '10px 0',
                  textAlign: 'center',
                  fontWeight: 800,
                }}
              >
                <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Amount Paid</div>
                <div style={{ fontSize: '28px', lineHeight: 1 }}>{receipt.totalPaidLabel}</div>
              </div>
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
            <div className="receipt-preview-sheet__section" style={{ textAlign: 'center', fontWeight: 800 }}>
              <div>Thank you for choosing eDENTAL CLINICS.</div>
              <div>We appreciate your trust and wish you a healthy smile.</div>
              <div style={{ marginTop: '6px' }}>Designed and Powered By: DALE QUIST [Enable Technologies]</div>
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

  const billBalance = Number(bill?.balance ?? 0);

  React.useEffect(() => {
    if (!isOpen || !bill) {
      return;
    }

    setStatus(billBalance > 0 ? 'partially_paid' : 'completed');
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
  }, [bill, billBalance, isOpen]);

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

  const usesInsurance = payments.some((entry) => entry.method === 'insurance');
  const insuranceLineCount = payments.reduce((count, entry) => count + (entry.method === 'insurance' ? 1 : 0), 0);
  const insuranceCoveredAmount = Number(insurance.insurance_covered_amount || 0);
  const getEffectivePaymentAmount = React.useCallback((entry) => {
    if (entry.method === 'insurance') {
      return insuranceCoveredAmount;
    }

    return Number(entry.amount || 0);
  }, [insuranceCoveredAmount]);
  const totalEntered = payments.reduce((sum, entry) => sum + getEffectivePaymentAmount(entry), 0);
  const requiresReference = payments.some((entry) => (
    ['mobile_money', 'card'].includes(entry.method) && String(entry.transaction_id ?? '').trim() === ''
  ));
  const remainingBalance = Math.max(0, billBalance - totalEntered);
  const enteredTotalLabel = formatCurrency(totalEntered);
  const remainingBalanceLabel = formatCurrency(remainingBalance);

  React.useEffect(() => {
    if (!bill || status === 'rejected') {
      return;
    }

    const nextStatus = totalEntered > 0 && totalEntered >= billBalance - 0.01
      ? 'completed'
      : 'partially_paid';

    setStatus((current) => (current === nextStatus ? current : nextStatus));
  }, [bill, status, totalEntered]);

  if (!isOpen || !bill) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (status !== 'rejected') {
      if (totalEntered <= 0) {
        setFeedback('Enter a payment amount greater than zero before issuing a receipt.');
        return;
      }

      if (totalEntered > billBalance + 0.01) {
        setFeedback('Total paid amount cannot exceed the remaining bill balance.');
        return;
      }

      if (payments.some((entry) => getEffectivePaymentAmount(entry) <= 0)) {
        setFeedback('Each payment line must have an amount greater than zero.');
        return;
      }

      if (requiresReference) {
        setFeedback('Transaction ID is required for Mobile Money and Card payments.');
        return;
      }

      if (
        usesInsurance &&
        (
          !String(insurance.insurance_type ?? '').trim() ||
          !String(insurance.insurance_number ?? '').trim() ||
          !String(insurance.expiry_date ?? '').trim() ||
          Number(insurance.insurance_covered_amount || 0) <= 0
        )
      ) {
        setFeedback('Insurance type, number, expiry date, and covered amount are required for insurance payments.');
        return;
      }
    }

    setSaving(true);
    setFeedback('');

    try {
      const response = await onSubmit({
        billing_id: bill.billingId,
        status: status === 'rejected'
          ? 'rejected'
          : (totalEntered >= billBalance - 0.01 ? 'completed' : 'partially_paid'),
        payments: payments.map((entry) => ({
          method: entry.method,
          amount: getEffectivePaymentAmount(entry),
          transaction_id: entry.transaction_id,
        })),
        insurance: {
          ...insurance,
          insurance_covered_amount: Number(insurance.insurance_covered_amount),
        },
      });
      onPaymentSaved(response?.receipt ?? null, response?.message ?? 'Payment saved successfully.');
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
            <div className="frontdesk-command-grid" style={{ marginTop: '16px' }}>
              <div className="frontdesk-highlight">
                <span>Entered total</span>
                <strong>{enteredTotalLabel}</strong>
                <p>Updates live while payment figures are being entered.</p>
              </div>
              <div className="frontdesk-highlight">
                <span>Remaining balance</span>
                <strong>{remainingBalanceLabel}</strong>
                <p>Autocalculated from the current bill balance minus the entered payment total.</p>
              </div>
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

          {status !== 'rejected' ? (
            <p className="table-subcopy" style={{ marginTop: '-4px' }}>
              The payment status adjusts automatically from the amount entered so the receipt can process smoothly.
            </p>
          ) : null}

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
                    <option disabled={insuranceLineCount > 0 && entry.method !== 'insurance'} value="insurance">Insurance</option>
                  </select>
                </label>

                <label className="field-block">
                  <span>Amount</span>
                  <input
                    min="0"
                    onChange={(event) => updatePayment(index, 'amount', event.target.value)}
                    placeholder={entry.method === 'insurance' ? 'Uses covered amount below' : '0.00'}
                    readOnly={entry.method === 'insurance'}
                    step="0.01"
                    type="number"
                    value={entry.method === 'insurance' ? insurance.insurance_covered_amount : entry.amount}
                  />
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
  dashboard,
  insurance,
  onCreateBillingPayment,
  onCreateFrontdeskBill,
  onDeleteBilling,
  onLoadReceipt,
  patients,
}) {
  const todayDate = React.useMemo(() => getTodayDateValue(), []);
  const [search, setSearch] = React.useState('');
  const [methodFilter, setMethodFilter] = React.useState('all');
  const [billTypeFilter, setBillTypeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [startDate, setStartDate] = React.useState(todayDate);
  const [endDate, setEndDate] = React.useState(todayDate);
  const [billRowsPerPage, setBillRowsPerPage] = React.useState(15);
  const [historyRowsPerPage, setHistoryRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [historyPage, setHistoryPage] = React.useState(1);
  const [selectedBill, setSelectedBill] = React.useState(null);
  const [frontdeskModalOpen, setFrontdeskModalOpen] = React.useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const [receiptHistoryModalOpen, setReceiptHistoryModalOpen] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState(null);
  const [receiptLoading, setReceiptLoading] = React.useState(false);
  const [deletingBillingId, setDeletingBillingId] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState('');

  const items = billing?.items ?? [];
  const history = billing?.history ?? [];
  const insuranceItems = insurance?.items ?? [];
  const filteredHistory = history.filter((item) => {
    const normalizedMethod = String(item.paymentMethod ?? '').toLowerCase();
    const matchesMethod = methodFilter === 'all'
      || (methodFilter === 'cash' && normalizedMethod.includes('cash'))
      || (methodFilter === 'mobile_money' && normalizedMethod.includes('mobile money'))
      || (methodFilter === 'paystack' && (normalizedMethod.includes('card') || normalizedMethod.includes('paystack')))
      || (methodFilter === 'bank' && normalizedMethod.includes('bank'))
      || (methodFilter === 'insurance' && normalizedMethod.includes('insurance'));

    return matchesMethod
      && inDateRange(item.paymentDate, startDate, endDate)
      && matchesHistorySearch(item, search);
  });
  const rangeInsuranceTotal = insuranceItems.reduce((sum, item) => (
    inDateRange(item.createdAt, startDate, endDate) ? sum + Number(item.coveredAmount ?? 0) : sum
  ), 0);
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyRowsPerPage));
  const currentHistoryPage = clampPage(historyPage, historyTotalPages);
  const paginatedHistory = filteredHistory.slice((currentHistoryPage - 1) * historyRowsPerPage, currentHistoryPage * historyRowsPerPage);
  const filteredItems = items.filter((item) => {
    return matchesSearch(item, search)
      && matchesBillFilters(item, billTypeFilter, statusFilter);
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / billRowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * billRowsPerPage, currentPage * billRowsPerPage);
  const filteredSalesTotal = filteredHistory.reduce((sum, item) => sum + Number(item.paidAmount ?? 0), 0);
  const filteredSalesBalance = filteredHistory.reduce((sum, item) => {
    const numeric = Number.parseFloat(String(item.remainingAmountLabel ?? '0').replace(/[^0-9.-]/g, ''));
    return sum + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);
  const paymentMethodTotals = filteredHistory.reduce((totals, item) => {
    const normalizedMethod = String(item.paymentMethod ?? '').toLowerCase();
    const amount = Number(item.paidAmount ?? 0);

    if (normalizedMethod.includes('cash')) {
      totals.cash += amount;
    }

    if (normalizedMethod.includes('mobile money')) {
      totals.mobileMoney += amount;
    }

    if (normalizedMethod.includes('paystack') || normalizedMethod.includes('card')) {
      totals.paystack += amount;
    }

    if (normalizedMethod.includes('bank')) {
      totals.bank += amount;
    }

    return totals;
  }, {
    cash: 0,
    mobileMoney: 0,
    paystack: 0,
    bank: 0,
  });
  const filteredOpenBillBalance = filteredItems.reduce((sum, item) => sum + Number(item.balance ?? 0), 0);
  const selectedRangeLabel = startDate || endDate
    ? `${startDate || 'Beginning'} to ${endDate || 'Today'}`
    : 'All available dates';

  const salesWidgets = [
    {
      label: 'Sales In Range',
      value: formatCurrency(filteredSalesTotal),
      trend: selectedRangeLabel,
      icon: 'trend',
    },
    {
      label: 'Sales + Insurance',
      value: formatCurrency(filteredSalesTotal + rangeInsuranceTotal),
      trend: `Insurance in range ${formatCurrency(rangeInsuranceTotal)}`,
      icon: 'shield',
    },
    {
      label: 'Sales Records',
      value: String(filteredHistory.length),
      trend: 'Receipt rows inside the selected range',
      icon: 'receipt',
    },
    {
      label: 'Open-Bill Balance',
      value: formatCurrency(filteredOpenBillBalance),
      trend: 'Current open-bill balance matching the live bill filters',
      icon: 'briefcase',
    },
  ];

  React.useEffect(() => {
    setPage(1);
  }, [search, billRowsPerPage, billTypeFilter, statusFilter]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setHistoryPage(1);
  }, [search, methodFilter, historyRowsPerPage, startDate, endDate]);

  React.useEffect(() => {
    setHistoryPage((current) => clampPage(current, historyTotalPages));
  }, [historyTotalPages]);

  function exportSalesExcel() {
    const rows = filteredHistory.map((item) => ([
      item.receiptNumber,
      item.bill,
      item.patientName,
      item.paymentMethod,
      item.paidAmountLabel,
      item.totalAmountLabel,
      item.remainingAmountLabel,
      item.dateLabel,
    ]));

    rows.push(['', '', '', 'TOTAL SALES', formatCurrency(filteredSalesTotal), '', formatCurrency(filteredSalesBalance), selectedRangeLabel]);

    downloadBlob(
      createExcelBlob('Dentiplus Sales Report', ['Receipt', 'Bill', 'Patient', 'Method', 'Paid', 'Total Bill', 'Balance', 'Date'], rows),
      'dentiplus-sales-report.xls',
    );
  }

  function exportSalesPdf() {
    openPrintableReport(
      'Dentiplus Sales Report',
      `Range: ${selectedRangeLabel}`,
      ['Receipt', 'Bill', 'Patient', 'Method', 'Paid', 'Total Bill', 'Balance', 'Date'],
      filteredHistory.map((item) => [
        item.receiptNumber,
        item.bill,
        item.patientName,
        item.paymentMethod,
        item.paidAmountLabel,
        item.totalAmountLabel,
        item.remainingAmountLabel,
        item.dateLabel,
      ]),
      [
        { label: 'Total Sales', value: formatCurrency(filteredSalesTotal) },
        { label: 'Balance', value: formatCurrency(filteredSalesBalance) },
      ],
    );
  }

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
      <section className="stats-grid content-grid">
        {salesWidgets.map((item) => (
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
            <p className="eyebrow">Sales and receipts</p>
            <h3>Accounting sales workspace</h3>
            <p>Filter sales by date range, reconcile totals against the widgets, export the ledger, then move into open-bill follow-up only after reviewing booked sales.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={() => setFrontdeskModalOpen(true)} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Consultation / registration bill</span>
            </button>
            <button className="ghost-button workspace-inline-action" onClick={exportSalesPdf} type="button">
              <PortalIcon className="workspace-submit-icon" name="reports" />
              <span>Export PDF</span>
            </button>
            <button className="ghost-button workspace-inline-action" onClick={exportSalesExcel} type="button">
              <PortalIcon className="workspace-submit-icon" name="layers" />
              <span>Export Excel</span>
            </button>
            <button className="ghost-button workspace-inline-action" onClick={() => setReceiptHistoryModalOpen(true)} type="button">
              <PortalIcon className="workspace-submit-icon" name="receipt" />
              <span>Recent receipts</span>
            </button>
          </div>
        </div>

        {successMessage ? <p className="form-success">{successMessage}</p> : null}

        <div className="reception-filter-strip reception-filter-strip--ledger">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search sales page</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Receipt, bill, patient, charge, dentist, method..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Method</span>
            <select onChange={(event) => setMethodFilter(event.target.value)} value={methodFilter}>
              <option value="all">All methods</option>
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="paystack">Paystack</option>
              <option value="bank">Bank</option>
              <option value="insurance">Insurance</option>
            </select>
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
            <span>Start date</span>
            <input max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          </label>
          <label className="field-block reception-inline-field">
            <span>End date</span>
            <input min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Open-bill rows</span>
            <select value={billRowsPerPage} onChange={(event) => setBillRowsPerPage(Number(event.target.value))}>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Sales rows</span>
            <select value={historyRowsPerPage} onChange={(event) => setHistoryRowsPerPage(Number(event.target.value))}>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
            </select>
          </label>
        </div>

        <div className="frontdesk-command-grid">
          <div className="frontdesk-highlight">
            <span>Open bills</span>
            <strong>{filteredItems.length}</strong>
            <p>Pending or partially paid grouped bills matching the current bill filters.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Total open bills</span>
            <strong>{items.length}</strong>
            <p>Current unpaid bill records still waiting for full settlement.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Cash / MoMo / Paystack / Bank</span>
            <strong>{formatCurrency(paymentMethodTotals.cash + paymentMethodTotals.mobileMoney + paymentMethodTotals.paystack + paymentMethodTotals.bank)}</strong>
            <p>Pure sales channels combined inside the selected range.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Receipt history</span>
            <strong>{filteredHistory.length}</strong>
            <p>Processed payments inside the selected range, ready for reprint and follow-up.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Sales ledger</p>
            <h3>Booked sales within range</h3>
          </div>
          <span className="table-counter">
            {filteredHistory.length} results | Page {currentHistoryPage} of {historyTotalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Bill</th>
                <th>Patient</th>
                <th>Method</th>
                <th>Paid</th>
                <th>Total Bill</th>
                <th>Balance</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length ? paginatedHistory.map((item) => (
                <tr key={`sales-history-${item.receiptNumber}`}>
                  <td>{item.receiptNumber}</td>
                  <td>{item.bill}</td>
                  <td><strong>{item.patientName}</strong></td>
                  <td>{item.paymentMethod}</td>
                  <td><strong>{item.paidAmountLabel}</strong></td>
                  <td>{item.totalAmountLabel}</td>
                  <td className="table-balance-negative"><strong>{item.remainingAmountLabel}</strong></td>
                  <td>{item.dateLabel}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">No sales records match the current range and filters.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="table-total-row">
                <td colSpan="4">Totals</td>
                <td><strong>{formatCurrency(filteredSalesTotal)}</strong></td>
                <td>-</td>
                <td className="table-balance-negative"><strong>{formatCurrency(filteredSalesBalance)}</strong></td>
                <td>{selectedRangeLabel}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedHistory.length ? (currentHistoryPage - 1) * historyRowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentHistoryPage * historyRowsPerPage, filteredHistory.length)} of {filteredHistory.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentHistoryPage <= 1} onClick={() => setHistoryPage((value) => Math.max(1, value - 1))} type="button">
              Previous
            </button>
            <button className="ghost-button secondary-action--compact" disabled={currentHistoryPage >= historyTotalPages} onClick={() => setHistoryPage((value) => Math.min(historyTotalPages, value + 1))} type="button">
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Open bills</p>
            <h3>Ready for payment after ledger review</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table payments-open-bills-table">
            <colgroup>
              <col className="payments-open-bills-table__col-bill" />
              <col className="payments-open-bills-table__col-patient" />
              <col className="payments-open-bills-table__col-charge" />
              <col className="payments-open-bills-table__col-type" />
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
                  <td className="payments-open-bills-table__bill-cell">{item.bill}</td>
                  <td className="payments-open-bills-table__patient-cell">
                    <strong>{item.patientName}</strong>
                    <span className="table-subcopy">{item.dentistName}</span>
                  </td>
                  <td className="payments-open-bills-table__charge-cell">
                    <div className="payments-open-bills-table__charge-copy" title={item.chargeSummary}>{item.chargeSummary}</div>
                  </td>
                  <td className="payments-open-bills-table__type-cell">
                    <div className="payments-open-bills-table__type-copy">{item.billTypeLabel}</div>
                  </td>
                  <td className="payments-open-bills-table__money-cell"><strong>{item.amountLabel}</strong></td>
                  <td className="table-balance-negative payments-open-bills-table__money-cell"><strong>{item.balanceLabel}</strong></td>
                  <td className="payments-open-bills-table__status-cell">
                    <div className="payments-open-bills-table__status-copy">{item.status}</div>
                  </td>
                  <td className="payments-open-bills-table__actions-cell">
                    <div className="reception-action-row payments-open-bills-table__actions-row">
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
                  <td colSpan="8">No open bills match the current range and filters.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="table-total-row">
                <td colSpan="4">Totals</td>
                <td><strong>{formatCurrency(filteredItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0))}</strong></td>
                <td className="table-balance-negative"><strong>{formatCurrency(filteredOpenBillBalance)}</strong></td>
                <td colSpan="2">{selectedRangeLabel}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedItems.length ? (currentPage - 1) * billRowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * billRowsPerPage, filteredItems.length)} of {filteredItems.length}
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
        onClose={(bill, message = '') => {
          setFrontdeskModalOpen(false);
          if (message) {
            setSuccessMessage(message);
          }
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
