import React from 'react';
import { DashboardStatIcon } from './DashboardStatIcon';

function formatCountLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function parseCurrencyValue(value) {
  const numeric = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(amount) {
  return `GHS ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReceptionistDashboard({
  appointmentsRows,
  billingRows,
  dashboard,
  expenseRows,
  messageRows,
  patientsRows,
  onNavigate,
}) {
  const metrics = dashboard?.metrics ?? {};
  const pendingBillings = billingRows.filter((row) =>
    String(row.status || '').toLowerCase().includes('pending') ||
    String(row.status || '').toLowerCase().includes('partial')
  );

  const waitingPatients = patientsRows.filter((row) =>
    ['waiting', 'registered', 'assigned'].includes(String(row.status || '').toLowerCase())
  );

  const completedAppointments = appointmentsRows.filter((row) =>
    String(row.status || '').toLowerCase().includes('completed')
  );

  const unreadThreads = messageRows.filter((row) => Number.parseInt(row.unread, 10) > 0);
  const newPatients = patientsRows.filter((row) =>
    ['registered', 'waiting', 'assigned'].includes(String(row.status || '').toLowerCase())
  );
  const todayAppointmentsCount = Number(metrics.today_appointments ?? appointmentsRows.length);
  const activeAssignmentsCount = Number(metrics.active_assignments ?? waitingPatients.length);
  const todayRegistrationsCount = Number(metrics.today_registrations ?? newPatients.length);

  const quickActions = [
    {
      eyebrow: 'Patient flow',
      title: 'Walk-in registration',
      description: 'Register new arrivals, issue folder IDs, and move them into the payment or assignment flow.',
      action: 'Open desk',
      target: 'walkin-registration',
    },
    {
      eyebrow: 'Queue control',
      title: 'Assign patient',
      description: 'Send ready patients to the right dentist and keep the chair queue tidy.',
      action: 'Assign now',
      target: 'assign-patient',
    },
    {
      eyebrow: 'Collections',
      title: 'Process payments',
      description: 'Handle cash, mobile money, card, and insurance handoffs without leaving the desk.',
      action: 'Open payments',
      target: 'payments',
    },
    {
      eyebrow: 'Customer care',
      title: 'Patient reminders',
      description: 'Follow up on missed visits, pending arrivals, and next-day appointment confirmations.',
      action: 'Open reminders',
      target: 'reminders',
    },
  ];

  const paymentBreakdown = dashboard?.payment_breakdown ?? {};
  const paymentMix = [
    { label: 'Cash', value: formatCurrency(Number(paymentBreakdown.cash ?? 0)), note: 'Front-desk collections today' },
    { label: 'Mobile Money', value: formatCurrency(Number(paymentBreakdown.mobile_money ?? 0)), note: 'Fast checkout lane' },
    { label: 'Card / Paystack', value: formatCurrency(Number(paymentBreakdown.card ?? 0)), note: 'Digital authorisations' },
    { label: 'Insurance', value: formatCurrency(Number(paymentBreakdown.insurance ?? 0)), note: 'Claims and cover notes' },
  ];

  const salesTotal = Number(dashboard?.today_revenue ?? paymentMix.reduce((sum, item) => sum + parseCurrencyValue(item.value), 0));
  const expensesTotal = Number(
    dashboard?.today_expenses ?? expenseRows.reduce((sum, item) => sum + parseCurrencyValue(item.amount), 0)
  );
  const todayExpenseCount = Number(
    dashboard?.today_expense_count ?? expenseRows.length
  );
  const statsWidgets = [
    {
      label: "Today's Appointments",
      value: String(todayAppointmentsCount),
      trend: `${completedAppointments.length} completed today`,
    },
    {
      label: 'New Patients',
      value: String(todayRegistrationsCount),
      trend: `${activeAssignmentsCount} still at the desk queue`,
    },
    {
      label: 'Expenses',
      value: formatCurrency(expensesTotal),
      trend: `${todayExpenseCount} front-desk expense ${todayExpenseCount === 1 ? 'entry' : 'entries'} today`,
    },
    {
      label: 'Sales',
      value: formatCurrency(salesTotal),
      trend: 'Cash, MoMo, card, and insurance today',
    },
  ];

  const reminders = patientsRows.slice(0, 4).map((row, index) => ({
    patient: row.patient,
    note: index % 2 === 0 ? 'Confirm next visit and dentist assignment.' : 'Follow up on pending billing balance.',
    due: index % 2 === 0 ? 'Today 4:00 PM' : 'Tomorrow 9:00 AM',
  }));

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
        <article className="module-card frontdesk-command-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Reception command</p>
              <h3>Front desk workboard</h3>
              <p>Built from the ASDental receptionist pattern: arrivals, payment flow, reminders, and queue control in one place.</p>
            </div>
            <button
              className="ghost-button secondary-action--compact"
              onClick={() => onNavigate('patient-database')}
              type="button"
            >
              Patient database
            </button>
          </div>

          <div className="frontdesk-command-grid">
            <div className="frontdesk-highlight">
              <span>Today&apos;s appointments</span>
              <strong>{formatCountLabel(todayAppointmentsCount, 'slot', 'slots')}</strong>
              <p>{formatCountLabel(completedAppointments.length, 'completed visit', 'completed visits')}</p>
            </div>
            <div className="frontdesk-highlight">
              <span>Waiting and registered</span>
              <strong>{formatCountLabel(activeAssignmentsCount, 'patient', 'patients')}</strong>
              <p>Ready for queueing, assignment, or payment desk follow-through.</p>
            </div>
            <div className="frontdesk-highlight">
              <span>Pending billings</span>
              <strong>{formatCountLabel(pendingBillings.length, 'billing file', 'billing files')}</strong>
              <p>Open balances still needing cashiering or insurance routing.</p>
            </div>
            <div className="frontdesk-highlight">
              <span>Unread service threads</span>
              <strong>{formatCountLabel(unreadThreads.length, 'thread', 'threads')}</strong>
              <p>Internal follow-ups and patient desk coordination.</p>
            </div>
          </div>
        </article>

        <article className="module-card frontdesk-payment-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Today&apos;s sales breakdown</p>
              <h3>Reception payment mix</h3>
              <p>Mirrors the ASDental receptionist emphasis on payment-method visibility and operational collections.</p>
            </div>
            <button
              className="ghost-button secondary-action--compact"
              onClick={() => onNavigate('payments')}
              type="button"
            >
              Payment desk
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
      </section>

      <section className="frontdesk-quick-grid">
        {quickActions.map((item) => (
          <article className="module-card quick-action-card" key={item.title}>
            <p className="eyebrow">{item.eyebrow}</p>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <button className="ghost-button" onClick={() => onNavigate(item.target)} type="button">
              {item.action}
            </button>
          </article>
        ))}
      </section>

      <div className="workspace-grid workspace-grid--wide">
        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Today&apos;s schedule</p>
              <h3>Appointments board</h3>
            </div>
            <button
              className="ghost-button secondary-action--compact"
              onClick={() => onNavigate('appointments')}
              type="button"
            >
              Open appointments
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Dentist</th>
                  <th>Procedure</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsRows.slice(0, 6).map((row, index) => (
                  <tr key={`desk-appointment-${index}`}>
                    <td>{row.time}</td>
                    <td>{row.patient}</td>
                    <td>{row.clinician}</td>
                    <td>{row.procedure}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Pending collections</p>
              <h3>Billing queue</h3>
            </div>
            <button
              className="ghost-button secondary-action--compact"
              onClick={() => onNavigate('payments')}
              type="button"
            >
              Process now
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Patient</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(pendingBillings.length ? pendingBillings : billingRows).slice(0, 6).map((row, index) => (
                  <tr key={`desk-billing-${index}`}>
                    <td>{row.bill}</td>
                    <td>{row.patient}</td>
                    <td>{row.amount}</td>
                    <td>{row.balance}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="workspace-grid workspace-grid--split">
        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Walk-in desk</p>
              <h3>Registration and assignment</h3>
              <p>Recent arrivals, folder handling, and next action visibility in the spirit of the ASDental receptionist desk.</p>
            </div>
          </div>

          <div className="frontdesk-list">
            {patientsRows.slice(0, 5).map((row, index) => (
              <div className="frontdesk-list-item" key={`patient-flow-${index}`}>
                <div>
                  <strong>{row.patient}</strong>
                  <span>{row.folder} | {row.phone}</span>
                </div>
                <div className="frontdesk-list-meta">
                  <span>{row.visitReason}</span>
                  <strong>{row.status}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Reminders and service</p>
              <h3>Customer-care follow-up</h3>
              <p>Patient reminders and desk communication sit beside the operational queue rather than in a detached inbox.</p>
            </div>
            <button
              className="ghost-button secondary-action--compact"
              onClick={() => onNavigate('customer-service')}
              type="button"
            >
              Customer service
            </button>
          </div>

          <div className="frontdesk-reminder-list">
            {reminders.map((item) => (
              <div className="frontdesk-reminder-item" key={`${item.patient}-${item.due}`}>
                <strong>{item.patient}</strong>
                <p>{item.note}</p>
                <span>{item.due}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
