import React from 'react';

function normalizeDate(value) {
  return value || '';
}

export function AppointmentBookingModal({
  dentists = [],
  isOpen,
  onClose,
  onSubmit,
  initialPatient = null,
  patients = [],
}) {
  const [form, setForm] = React.useState({
    patient_id: '',
    patient_name: '',
    phone: '',
    dentist_id: '',
    appointment_date: '',
    appointment_time: '',
    procedure: '',
    notes: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm({
      patient_id: initialPatient?.id ? String(initialPatient.id) : '',
      patient_name: initialPatient?.patientName ?? initialPatient?.patient ?? '',
      phone: initialPatient?.phone ?? '',
      dentist_id: '',
      appointment_date: '',
      appointment_time: '',
      procedure: initialPatient?.visitReason ?? initialPatient?.rawVisitReason ?? '',
      notes: '',
    });
    setFeedback('');
  }, [initialPatient, isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateField(event) {
    const { name, value } = event.target;

    if (name === 'patient_id') {
      const patient = patients.find((item) => String(item.id) === value);
      setForm((current) => ({
        ...current,
        patient_id: value,
        patient_name: patient?.patientName ?? current.patient_name,
        phone: patient?.phone ?? current.phone,
        procedure: current.procedure || patient?.visitReason || patient?.rawVisitReason || '',
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback('');
    setSaving(true);

    try {
      await onSubmit({
        patient_id: form.patient_id ? Number(form.patient_id) : null,
        patient_name: form.patient_name,
        phone: form.phone,
        dentist_id: Number(form.dentist_id),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        procedure: form.procedure,
        notes: form.notes,
      });
      onClose();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="workspace-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">Reception booking</p>
            <h3>Book appointment</h3>
            <p>Schedule an existing patient or type a one-off booking when needed.</p>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-block field-block--wide">
              <span>Existing patient</span>
              <select name="patient_id" onChange={updateField} value={form.patient_id}>
                <option value="">Select an existing patient if available</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patientName} | {patient.folderId} | {patient.phone}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>Patient name</span>
              <input
                name="patient_name"
                onChange={updateField}
                placeholder="Type patient name"
                type="text"
                value={form.patient_name}
              />
            </label>

            <label className="field-block">
              <span>Phone number</span>
              <input name="phone" onChange={updateField} placeholder="054..." type="text" value={form.phone} />
            </label>

            <label className="field-block">
              <span>Dentist</span>
              <select name="dentist_id" onChange={updateField} required value={form.dentist_id}>
                <option value="">Choose dentist</option>
                {dentists.map((dentist) => (
                  <option key={dentist.id} value={dentist.id}>
                    {dentist.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>Procedure / visit reason</span>
              <input
                name="procedure"
                onChange={updateField}
                placeholder="Consultation, pain, review..."
                required
                type="text"
                value={form.procedure}
              />
            </label>

            <label className="field-block">
              <span>Appointment date</span>
              <input
                min={normalizeDate(new Date().toISOString().slice(0, 10))}
                name="appointment_date"
                onChange={updateField}
                required
                type="date"
                value={form.appointment_date}
              />
            </label>

            <label className="field-block">
              <span>Appointment time</span>
              <input name="appointment_time" onChange={updateField} required type="time" value={form.appointment_time} />
            </label>

            <label className="field-block field-block--wide">
              <span>Notes</span>
              <textarea
                name="notes"
                onChange={updateField}
                placeholder="Desk notes or handoff details"
                rows={4}
                value={form.notes}
              />
            </label>
          </div>

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Booking appointment...' : 'Book appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WalkinRegistrationModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = React.useState({
    first_name: '',
    other_names: '',
    last_name: '',
    phone: '',
    email: '',
    birth_date: '',
    gender: '',
    address: '',
    marital_status: '',
    occupation: '',
    employer: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    referral_source: '',
    visit_reason: '',
    assignment_visit_reason: '',
    medical_history: '',
    current_medications: '',
    allergies: '',
    dental_history: '',
    last_dental_visit: '',
    alcohol_use: '',
    smoking: '',
    pregnancy_status: '',
    social_media_consent: '',
    old_folder_id: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setFeedback('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback('');
    setSaving(true);

    try {
      await onSubmit({
        ...form,
        medical_history: form.medical_history
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setForm({
        first_name: '',
        other_names: '',
        last_name: '',
        phone: '',
        email: '',
        birth_date: '',
        gender: '',
        address: '',
        marital_status: '',
        occupation: '',
        employer: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        referral_source: '',
        visit_reason: '',
        assignment_visit_reason: '',
        medical_history: '',
        current_medications: '',
        allergies: '',
        dental_history: '',
        last_dental_visit: '',
        alcohol_use: '',
        smoking: '',
        pregnancy_status: '',
        social_media_consent: '',
        old_folder_id: '',
      });
      onClose();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="workspace-modal workspace-modal--wide"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">Walk-in intake</p>
            <h3>Register new walk-in patient</h3>
            <p>Built around the current patient table so the desk can capture real intake data in one place.</p>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="workspace-modal__body" onSubmit={handleSubmit}>
          <div className="workspace-form-section">
            <h4>Core patient details</h4>
            <div className="form-grid">
              <label className="field-block">
                <span>First name</span>
                <input name="first_name" onChange={updateField} required type="text" value={form.first_name} />
              </label>
              <label className="field-block">
                <span>Other names</span>
                <input name="other_names" onChange={updateField} type="text" value={form.other_names} />
              </label>
              <label className="field-block">
                <span>Last name</span>
                <input name="last_name" onChange={updateField} required type="text" value={form.last_name} />
              </label>
              <label className="field-block">
                <span>Phone</span>
                <input name="phone" onChange={updateField} required type="text" value={form.phone} />
              </label>
              <label className="field-block">
                <span>Email</span>
                <input name="email" onChange={updateField} type="email" value={form.email} />
              </label>
              <label className="field-block">
                <span>Gender</span>
                <select name="gender" onChange={updateField} required value={form.gender}>
                  <option value="">Choose gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field-block">
                <span>Birth date</span>
                <input name="birth_date" onChange={updateField} required type="date" value={form.birth_date} />
              </label>
              <label className="field-block">
                <span>Old folder ID</span>
                <input name="old_folder_id" onChange={updateField} type="text" value={form.old_folder_id} />
              </label>
              <label className="field-block field-block--wide">
                <span>Address</span>
                <textarea name="address" onChange={updateField} required rows={3} value={form.address} />
              </label>
            </div>
          </div>

          <div className="workspace-form-section">
            <h4>Visit and contact details</h4>
            <div className="form-grid">
              <label className="field-block">
                <span>Visit reason</span>
                <input name="visit_reason" onChange={updateField} type="text" value={form.visit_reason} />
              </label>
              <label className="field-block">
                <span>Assignment visit reason</span>
                <input name="assignment_visit_reason" onChange={updateField} type="text" value={form.assignment_visit_reason} />
              </label>
              <label className="field-block">
                <span>Referral source</span>
                <input name="referral_source" onChange={updateField} type="text" value={form.referral_source} />
              </label>
              <label className="field-block">
                <span>Marital status</span>
                <input name="marital_status" onChange={updateField} type="text" value={form.marital_status} />
              </label>
              <label className="field-block">
                <span>Occupation</span>
                <input name="occupation" onChange={updateField} type="text" value={form.occupation} />
              </label>
              <label className="field-block">
                <span>Employer</span>
                <input name="employer" onChange={updateField} type="text" value={form.employer} />
              </label>
              <label className="field-block">
                <span>Emergency contact name</span>
                <input name="emergency_contact_name" onChange={updateField} type="text" value={form.emergency_contact_name} />
              </label>
              <label className="field-block">
                <span>Emergency contact phone</span>
                <input name="emergency_contact_phone" onChange={updateField} type="text" value={form.emergency_contact_phone} />
              </label>
            </div>
          </div>

          <div className="workspace-form-section">
            <h4>Medical and dental history</h4>
            <div className="form-grid">
              <label className="field-block field-block--wide">
                <span>Medical history</span>
                <textarea
                  name="medical_history"
                  onChange={updateField}
                  placeholder="Comma-separated if you want multiple items"
                  rows={3}
                  value={form.medical_history}
                />
              </label>
              <label className="field-block field-block--wide">
                <span>Current medications</span>
                <textarea name="current_medications" onChange={updateField} rows={3} value={form.current_medications} />
              </label>
              <label className="field-block field-block--wide">
                <span>Allergies</span>
                <textarea name="allergies" onChange={updateField} rows={3} value={form.allergies} />
              </label>
              <label className="field-block field-block--wide">
                <span>Dental history</span>
                <textarea name="dental_history" onChange={updateField} rows={3} value={form.dental_history} />
              </label>
              <label className="field-block">
                <span>Last dental visit</span>
                <input name="last_dental_visit" onChange={updateField} type="date" value={form.last_dental_visit} />
              </label>
              <label className="field-block">
                <span>Alcohol use</span>
                <input name="alcohol_use" onChange={updateField} type="text" value={form.alcohol_use} />
              </label>
              <label className="field-block">
                <span>Smoking</span>
                <input name="smoking" onChange={updateField} type="text" value={form.smoking} />
              </label>
              <label className="field-block">
                <span>Pregnancy status</span>
                <input name="pregnancy_status" onChange={updateField} type="text" value={form.pregnancy_status} />
              </label>
              <label className="field-block">
                <span>Social media consent</span>
                <input name="social_media_consent" onChange={updateField} type="text" value={form.social_media_consent} />
              </label>
            </div>
          </div>

          {feedback ? <p className="form-error">{feedback}</p> : null}

          <div className="workspace-card__actions">
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Registering patient...' : 'Register walk-in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
