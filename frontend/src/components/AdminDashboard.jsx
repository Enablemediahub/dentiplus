import React from 'react';
import { DashboardStatIcon } from './DashboardStatIcon';

function formatCurrency(amount) {
  return `GHS ${Number(amount ?? 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AdminDashboard({
  appointmentsRows,
  billingRows,
  dashboard,
  onNavigate,
  patientsRows,
  staffRows,
}) {
  const metrics = dashboard?.metrics ?? {};
  const breakdown = dashboard?.payment_breakdown ?? {};

  const statsWidgets = [
    {
      label: 'Sales Today',
      value: formatCurrency(Number(metrics.today_sales ?? 0)),
      trend: 'Cash, MoMo, Paystack, and bank only',
      icon: 'trend',
    },
    {
      label: 'Expenses Today',
      value: formatCurrency(Number(dashboard?.today_expenses ?? 0)),
      trend: `${Number(dashboard?.today_expense_count ?? 0)} expense entries recorded`,
      icon: 'finance',
    },
    {
      label: 'Sales + Insurance',
      value: formatCurrency(Number(metrics.sales_plus_insurance ?? 0)),
      trend: `Insurance today ${formatCurrency(Number(metrics.today_insurance ?? 0))}`,
      icon: 'shield',
    },
    {
      label: 'Patients Today',
      value: String(Number(metrics.today_patients ?? 0)),
      trend: `${Number(metrics.today_appointments ?? 0)} appointments on today’s board`,
      icon: 'patients',
    },
  ];

  const paymentMix = [
    { label: 'Cash', value: formatCurrency(Number(breakdown.cash ?? 0)), note: 'Physical desk collections today' },
    { label: 'Mobile Money', value: formatCurrency(Number(breakdown.mobile_money ?? 0)), note: 'MoMo settlements confirmed today' },
    { label: 'Paystack', value: formatCurrency(Number(breakdown.paystack ?? 0)), note: 'Card and Paystack sales booked today' },
    { label: 'Bank', value: formatCurrency(Number(breakdown.bank ?? 0)), note: 'Bank-transfer sales received today' },
  ];

  const operatingCards = [
    {
      label: 'Open Bills',
      value: String(Number(metrics.open_bills ?? billingRows.length)),
      note: 'Bills still waiting for full settlement or action.',
      target: 'sales',
    },
    {
      label: 'Active Staff',
      value: String(Number(metrics.staff_count ?? staffRows.length)),
      note: 'Visible staff records across the clinic platform.',
      target: 'staff',
    },
    {
      label: 'Waiting Queue',
      value: String(Number(metrics.active_assignments ?? 0)),
      note: 'Patients still in the chair-flow queue right now.',
      target: 'appointments',
    },
    {
      label: 'New Registrations',
      value: String(Number(metrics.today_registrations ?? 0)),
      note: 'Patient records created today from the live register.',
      target: 'patients',
    },
  ];

  return (
    <>
      <section className="stats-grid content-grid">
        {statsWidgets.map((item) => (
          <article className="stat-card" key={item.label}>
            <div className="stat-card-icon">
              <DashboardStatIcon item={item} />
            </div>
            <span className="stat-card__label">{item.label}</span>
            <h3>{item.value}</h3>
            <p className="stat-card__trend">{item.trend}</p>
          </article>
        ))}
      </section>

      <section className="frontdesk-hero-grid">
        <article className="module-card frontdesk-payment-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Sales breakdown</p>
              <h3>Today&apos;s payment mix</h3>
              <p>Pure sales are split into the payment channels that matter operationally for admin review.</p>
            </div>
            <button className="ghost-button secondary-action--compact" onClick={() => onNavigate('sales')} type="button">
              Open sales desk
            </button>
          </div>

          <div className="frontdesk-payment-list">
            {paymentMix.map((item) => (
              <div className="frontdesk-payment-item" key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.note}</p>
                </div>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="module-card frontdesk-command-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Admin operations</p>
              <h3>Platform pulse</h3>
              <p>Keep the executive view focused on throughput, staffing, unsettled work, and patient movement.</p>
            </div>
            <button className="ghost-button secondary-action--compact" onClick={() => onNavigate('database')} type="button">
              Open database
            </button>
          </div>

          <div className="frontdesk-command-grid">
            {operatingCards.map((item) => (
              <button className="frontdesk-highlight admin-highlight-button" key={item.label} onClick={() => onNavigate(item.target)} type="button">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </button>
            ))}
          </div>
        </article>
      </section>

      <div className="workspace-grid workspace-grid--wide">
        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Today&apos;s appointments</p>
              <h3>Clinic schedule board</h3>
            </div>
            <button className="ghost-button secondary-action--compact" onClick={() => onNavigate('appointments')} type="button">
              Open appointments
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Procedure</th>
                  <th>Dentist</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsRows.length ? appointmentsRows.slice(0, 8).map((row, index) => (
                  <tr key={`admin-appointments-${row.id ?? index}`}>
                    <td>{row.patientName ?? row.patient}</td>
                    <td>{row.procedure}</td>
                    <td>{row.dentistName ?? row.clinician}</td>
                    <td>{row.time}</td>
                    <td>{row.status}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5">No appointment activity is available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Patient activity</p>
              <h3>Today&apos;s visible patient flow</h3>
            </div>
            <button className="ghost-button secondary-action--compact" onClick={() => onNavigate('patients')} type="button">
              Open patients
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folder</th>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Visit reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patientsRows.length ? patientsRows.slice(0, 8).map((row, index) => (
                  <tr key={`admin-patients-${row.id ?? index}`}>
                    <td>{row.folderId ?? row.folder}</td>
                    <td>{row.patientName ?? row.patient}</td>
                    <td>{row.phone}</td>
                    <td>{row.visitReason}</td>
                    <td>{row.status}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5">No patient movement is available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
