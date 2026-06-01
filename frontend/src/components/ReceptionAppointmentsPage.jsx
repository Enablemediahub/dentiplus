import React from 'react';
import { AppointmentBookingModal } from './ReceptionDeskModals';
import { PortalIcon } from './PortalIcon';

function formatPhoneNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) {
    return '-';
  }

  if (digits.startsWith('233') && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  if (digits.length === 9) {
    return `0${digits}`;
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    return digits;
  }

  return digits;
}

function matchesSearch(item, query) {
  const haystack = [
    item.patientName,
    item.patient,
    item.procedure,
    item.clinician,
    formatPhoneNumber(item.phone),
    item.dateLabel,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function appointmentDateTime(item) {
  const date = String(item.date ?? '').trim();
  const time = String(item.time ?? '').trim() || '00:00';
  const parsed = new Date(`${date}T${time}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isUpcomingAppointment(item, now) {
  const parsed = appointmentDateTime(item);
  return parsed !== null && parsed >= now;
}

function isSameWeek(date, now) {
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return date >= start && date < end;
}

function isSameMonth(date, now) {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function matchesUpcomingWindow(item, window, now) {
  const parsed = appointmentDateTime(item);
  if (parsed === null || parsed < now) {
    return false;
  }

  if (window === 'week') {
    return isSameWeek(parsed, now);
  }

  if (window === 'month') {
    return isSameMonth(parsed, now);
  }

  return true;
}

export function ReceptionAppointmentsPage({ appointments, onCreateAppointment, patients }) {
  const [search, setSearch] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [todayPage, setTodayPage] = React.useState(1);
  const [notesPage, setNotesPage] = React.useState(1);
  const [upcomingWindow, setUpcomingWindow] = React.useState('week');
  const rowsPerPage = 5;
  const now = new Date();

  const items = appointments?.items ?? [];
  const todayItems = appointments?.todayItems ?? items.filter((item) => item.isToday);
  const dentists = appointments?.dentists ?? [];
  const patientItems = patients?.items ?? [];
  const filteredItems = items.filter((item) => matchesSearch(item, search));
  const filteredTodayItems = todayItems.filter((item) => matchesSearch(item, search));
  const filteredUpcomingItems = filteredItems.filter((item) => matchesUpcomingWindow(item, upcomingWindow, now));
  const filteredNewItems = [...filteredItems]
    .filter((item) => {
      const parsed = appointmentDateTime(item);
      return parsed !== null && parsed >= now && String(item.status ?? '').toLowerCase() === 'scheduled';
    })
    .sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0))
    .slice(0, 5);

  React.useEffect(() => {
    setTodayPage(1);
    setNotesPage(1);
  }, [search, upcomingWindow]);

  const todayPageCount = Math.max(1, Math.ceil(filteredTodayItems.length / rowsPerPage));
  const notesPageCount = Math.max(1, Math.ceil(filteredUpcomingItems.length / rowsPerPage));
  const pagedTodayItems = filteredTodayItems.slice((todayPage - 1) * rowsPerPage, todayPage * rowsPerPage);
  const pagedNotesItems = filteredUpcomingItems.slice((notesPage - 1) * rowsPerPage, notesPage * rowsPerPage);

  const statusCounts = filteredItems.reduce((accumulator, item) => {
    const key = String(item.status || '').toLowerCase();
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Reception appointments</p>
            <h3>Appointment board and booking desk</h3>
            <p>Modeled after the ASDental receptionist flow, but cleaner: today&apos;s queue, upcoming bookings, and quick booking in one surface.</p>
          </div>
          <button className="primary-button" onClick={() => setIsModalOpen(true)} type="button">
            New appointment
          </button>
        </div>

        {successMessage ? <p className="form-success">{successMessage}</p> : null}

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search bookings</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Patient, procedure, phone, dentist..."
              type="text"
              value={search}
            />
          </label>
          <label className="field-block reception-inline-field">
            <span>Upcoming focus</span>
            <select onChange={(event) => setUpcomingWindow(event.target.value)} value={upcomingWindow}>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="all">All upcoming</option>
            </select>
          </label>
        </div>

        <div className="frontdesk-command-grid">
          <div className="frontdesk-highlight">
            <span>Today&apos;s appointments</span>
            <strong>{todayItems.length}</strong>
            <p>Visible immediately for same-day front desk handling.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Scheduled</span>
            <strong>{statusCounts.scheduled ?? 0}</strong>
            <p>Open future and same-day bookings.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>New bookings</span>
            <strong>{filteredNewItems.length}</strong>
            <p>Most recently booked scheduled appointments waiting for desk follow-through.</p>
          </div>
          <div className="frontdesk-highlight">
            <span>Available dentists</span>
            <strong>{dentists.length}</strong>
            <p>Filtered to the receptionist branch when applicable.</p>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">New bookings</p>
            <h3>Latest scheduled appointments</h3>
          </div>
          <span className="table-counter">{filteredNewItems.length} results</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient</th>
                <th>Phone</th>
                <th>Dentist</th>
                <th>Procedure</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredNewItems.length ? filteredNewItems.map((item) => (
                <tr key={`new-appointment-${item.id}`}>
                  <td>{item.dateLabel}</td>
                  <td>{item.time}</td>
                  <td>{item.patientName}</td>
                  <td>{formatPhoneNumber(item.phone)}</td>
                  <td>{item.dentistName}</td>
                  <td>{item.procedure}</td>
                  <td>{item.status}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7">No new scheduled appointments match the current search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="workspace-grid workspace-grid--split">
        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Today&apos;s queue</p>
              <h3>Today&apos;s appointments</h3>
            </div>
            <span className="table-counter">{filteredTodayItems.length} results</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Dentist</th>
                  <th>Time</th>
                  <th>Phone</th>
                  <th>Procedure</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedTodayItems.length ? pagedTodayItems.map((item) => (
                  <tr key={`today-appointment-${item.id}`}>
                    <td>{item.patientName}</td>
                    <td>{item.dentistName}</td>
                    <td>{item.time}</td>
                    <td>{formatPhoneNumber(item.phone)}</td>
                    <td>{item.procedure}</td>
                    <td>{item.status}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6">No appointments are booked for today yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <button
              className="ghost-button secondary-action--compact"
              disabled={todayPage === 1}
              onClick={() => setTodayPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <span>Page {todayPage} of {todayPageCount}</span>
            <button
              className="ghost-button secondary-action--compact"
              disabled={todayPage === todayPageCount}
              onClick={() => setTodayPage((current) => Math.min(todayPageCount, current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </section>

        <section className="module-card">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Booking notes</p>
              <h3>Upcoming appointments</h3>
            </div>
            <span className="table-counter">{filteredUpcomingItems.length} results</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Dentist</th>
                  <th>Procedure</th>
                </tr>
              </thead>
              <tbody>
                {pagedNotesItems.length ? pagedNotesItems.map((item) => (
                  <tr key={`appointment-${item.id}`}>
                    <td>{item.dateLabel}</td>
                    <td>{item.patientName}</td>
                    <td>{formatPhoneNumber(item.phone)}</td>
                    <td>{item.dentistName}</td>
                    <td>{item.procedure}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5">No upcoming appointments match the current search and time window.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <button
              className="ghost-button secondary-action--compact"
              disabled={notesPage === 1}
              onClick={() => setNotesPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <span>Page {notesPage} of {notesPageCount}</span>
            <button
              className="ghost-button secondary-action--compact"
              disabled={notesPage === notesPageCount}
              onClick={() => setNotesPage((current) => Math.min(notesPageCount, current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </section>
      </div>

      <AppointmentBookingModal
        dentists={dentists}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(response) => setSuccessMessage(response?.message ?? 'Appointment booked successfully.')}
        onSubmit={onCreateAppointment}
        patients={patientItems}
      />
    </>
  );
}
