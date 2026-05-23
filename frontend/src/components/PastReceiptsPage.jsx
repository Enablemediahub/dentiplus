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
              <div style={{ border: '2px solid currentColor', borderRadius: '12px', padding: '12px 10px', margin: '10px 0', textAlign: 'center', fontWeight: 800 }}>
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
                  <div className="receipt-preview-sheet__line" key={`past-receipt-procedure-${index}`}>
                    <span>{entry.name}</span>
                    <span>{formatCurrency(entry.amount)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="receipt-preview-sheet__section">
              <strong>Payments</strong>
              {receipt.paymentLines.map((line) => (
                <div className="receipt-preview-sheet__line" key={`past-receipt-payment-${line.paymentId || `${line.method}-${line.amount}`}`}>
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

export function PastReceiptsPage({ billing, onLoadReceipt }) {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [receiptLoading, setReceiptLoading] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const history = billing?.history ?? [];

  const filteredHistory = history.filter((item) => {
    const trimmed = search.trim().toLowerCase();
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
      item.dateLabel,
    ].join(' ').toLowerCase().includes(trimmed);
  });

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [rowsPerPage, search]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  async function handleOpenReceipt(receiptNumber) {
    setReceiptLoading(true);
    try {
      const receipt = await onLoadReceipt(receiptNumber);
      setActiveReceipt(receipt);
      setReceiptModalOpen(true);
    } finally {
      setReceiptLoading(false);
    }
  }

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Reprint desk</p>
            <h3>Past receipts</h3>
            <p>Search by receipt number, patient, bill, payment method, or date, then open the thermal receipt for printing when clients return later.</p>
          </div>
          <span className="table-counter">
            {filteredHistory.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="reception-filter-strip reception-filter-strip--ledger">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search receipts</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Receipt, patient, bill, method, date..." type="text" value={search} />
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
            <p className="eyebrow">Receipt archive</p>
            <h3>Searchable thermal reprints</h3>
          </div>
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
                <th>Balance</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length ? paginatedHistory.map((item) => (
                <tr key={`past-receipt-${item.receiptNumber}`}>
                  <td><strong>{item.receiptNumber}</strong></td>
                  <td>
                    <strong>{item.bill}</strong>
                    <span className="table-subcopy">{item.chargeSummary}</span>
                  </td>
                  <td>
                    <strong>{item.patientName}</strong>
                    <span className="table-subcopy">{item.dentistName}</span>
                  </td>
                  <td>{item.paymentMethod}</td>
                  <td><strong>{item.paidAmountLabel}</strong></td>
                  <td className="table-balance-negative"><strong>{item.remainingAmountLabel}</strong></td>
                  <td>{item.dateLabel}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" disabled={receiptLoading} onClick={() => handleOpenReceipt(item.receiptNumber)} type="button">
                      {receiptLoading ? 'Loading...' : 'Print receipt'}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">No receipts match the current search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedHistory.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredHistory.length)} of {filteredHistory.length}
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

      <ReceiptPreviewModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onPrint={printThermalReceipt}
        receipt={activeReceipt}
      />
    </>
  );
}
