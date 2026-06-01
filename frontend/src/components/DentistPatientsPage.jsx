import React from 'react';
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

function matchesSearch(patient, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    patient.patientName,
    patient.folderId,
    patient.oldFolderId,
    patient.phone,
    patient.email,
    patient.gender,
    patient.address,
    patient.visitReason,
    patient.status,
  ]
    .join(' ')
    .toLowerCase()
    .includes(trimmed);
}

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function nowDateTimeLocalValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const CUSTOM_PRESCRIPTION_VALUE = '__other__';

const COMMON_DENTAL_MEDICATIONS = [
  'Amoxicillin 500mg capsule',
  'Amoxicillin-clavulanate 625mg tablet',
  'Metronidazole 400mg tablet',
  'Ciprofloxacin 500mg tablet',
  'Azithromycin 500mg tablet',
  'Doxycycline 100mg capsule',
  'Flucloxacillin 500mg capsule',
  'Ibuprofen 400mg tablet',
  'Diclofenac 50mg tablet',
  'Paracetamol 500mg tablet',
  'Paracetamol + Codeine tablet',
  'Celecoxib 200mg capsule',
  'Chlorhexidine mouthwash 0.2%',
  'Nystatin oral suspension',
  'Miconazole oral gel',
];

const STANDARD_DOSAGE_OPTIONS = [
  '200mg',
  '400mg',
  '500mg',
  '625mg',
  '1g',
  '5ml',
  '10ml',
  '15ml',
  '1 tablet',
  '2 tablets',
  '1 capsule',
  '2 capsules',
  '10ml rinse',
  'Apply thin film',
];

const STANDARD_FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'At night',
  'After meals',
  'Before meals',
  'As needed for pain',
  'Morning and night',
  'Rinse twice daily',
  'Apply three times daily',
];

const STANDARD_DURATION_OPTIONS = [
  '1 day',
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  '21 days',
  'Until finished',
  'As needed for 3 days',
  'As needed for 5 days',
];

const EMPTY_CLINICAL_SUGGESTIONS = {
  prescription: {
    medication: [],
    dosage: [],
    frequency: [],
    duration: [],
  },
};

function uniqueTextList(values = []) {
  const seen = new Set();

  return values.filter((value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      return false;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).map((value) => String(value).trim());
}

function mergeSuggestionPayload(current = EMPTY_CLINICAL_SUGGESTIONS, incoming = {}) {
  const nextPrescription = incoming?.prescription ?? {};

  return {
    prescription: {
      medication: uniqueTextList([...(current?.prescription?.medication ?? []), ...(nextPrescription.medication ?? [])]),
      dosage: uniqueTextList([...(current?.prescription?.dosage ?? []), ...(nextPrescription.dosage ?? [])]),
      frequency: uniqueTextList([...(current?.prescription?.frequency ?? []), ...(nextPrescription.frequency ?? [])]),
      duration: uniqueTextList([...(current?.prescription?.duration ?? []), ...(nextPrescription.duration ?? [])]),
    },
  };
}

function mergeOptionLists(defaultOptions, learnedOptions) {
  return uniqueTextList([...defaultOptions, ...(learnedOptions ?? [])]);
}

function emptyPrescriptionEntry() {
  return prescriptionEntryFromValues();
}

function normalizeLeadingUppercase(value) {
  return String(value ?? '').replace(/^([a-z])/, (match) => match.toUpperCase());
}

function toDateOnly(value) {
  return String(value ?? '').split('T')[0] || '';
}

function toDateTimeLocalValue(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return nowDateTimeLocalValue();
  }

  if (text.includes('T')) {
    return text.slice(0, 16);
  }

  return `${text}T00:00`;
}

function matchesOption(options, value) {
  return options.includes(String(value ?? '').trim());
}

function isCustomPrescriptionValue(options, value) {
  const text = String(value ?? '').trim();
  return text !== '' && !matchesOption(options, text);
}

function selectedPrescriptionOption(options, value) {
  return matchesOption(options, value) ? value : '';
}

function buildPrescriptionOptionSets(clinicalSuggestions = EMPTY_CLINICAL_SUGGESTIONS) {
  return {
    medication: mergeOptionLists(COMMON_DENTAL_MEDICATIONS, clinicalSuggestions?.prescription?.medication),
    dosage: mergeOptionLists(STANDARD_DOSAGE_OPTIONS, clinicalSuggestions?.prescription?.dosage),
    frequency: mergeOptionLists(STANDARD_FREQUENCY_OPTIONS, clinicalSuggestions?.prescription?.frequency),
    duration: mergeOptionLists(STANDARD_DURATION_OPTIONS, clinicalSuggestions?.prescription?.duration),
  };
}

function prescriptionEntryFromValues(values = {}, optionSets = buildPrescriptionOptionSets()) {
  const medication = String(values.medication ?? '').trim();
  const dosage = String(values.dosage ?? '').trim();
  const frequency = String(values.frequency ?? '').trim();
  const duration = String(values.duration ?? '').trim();

  return {
    medication,
    dosage,
    frequency,
    duration,
    instructions: String(values.instructions ?? ''),
    medication_option: medication === ''
      ? ''
      : (isCustomPrescriptionValue(optionSets.medication, medication)
        ? CUSTOM_PRESCRIPTION_VALUE
        : selectedPrescriptionOption(optionSets.medication, medication)),
    dosage_option: dosage === ''
      ? ''
      : (isCustomPrescriptionValue(optionSets.dosage, dosage)
        ? CUSTOM_PRESCRIPTION_VALUE
        : selectedPrescriptionOption(optionSets.dosage, dosage)),
    frequency_option: frequency === ''
      ? ''
      : (isCustomPrescriptionValue(optionSets.frequency, frequency)
        ? CUSTOM_PRESCRIPTION_VALUE
        : selectedPrescriptionOption(optionSets.frequency, frequency)),
    duration_option: duration === ''
      ? ''
      : (isCustomPrescriptionValue(optionSets.duration, duration)
        ? CUSTOM_PRESCRIPTION_VALUE
        : selectedPrescriptionOption(optionSets.duration, duration)),
  };
}

function calculateAgeLabel(birthDate) {
  const value = String(birthDate ?? '').trim();
  if (!value) {
    return 'Age not recorded';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Age not recorded';
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDelta = today.getMonth() - parsed.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} years` : 'Age not recorded';
}

const VIEW_CONFIG = {
  patients: {
    eyebrow: 'Patient records',
    title: 'All patients',
    body: 'Search the full patient register and open one clinical workspace with records and prescriptions in tabs.',
    defaultTab: 'medical-records',
  },
  'medical-records': {
    eyebrow: 'Clinical records',
    title: 'Medical records',
    body: 'Search the patient and open the clinical workspace directly on the medical records tab.',
    defaultTab: 'medical-records',
  },
  'new-medical-record': {
    eyebrow: 'Clinical records',
    title: 'New medical record',
    body: 'Search the patient and open the clinical workspace directly on the new medical record tab.',
    defaultTab: 'new-medical-record',
  },
  'prescription-history': {
    eyebrow: 'Clinical records',
    title: 'Prescription history',
    body: 'Search the patient and open the clinical workspace directly on the prescription history tab.',
    defaultTab: 'prescription-history',
  },
  'new-prescription': {
    eyebrow: 'Clinical records',
    title: 'New prescription',
    body: 'Search the patient and open the clinical workspace directly on the new prescription tab.',
    defaultTab: 'new-prescription',
  },
};

const TAB_CONFIG = {
  'medical-records': {
    label: 'Medical Records',
    icon: 'clipboard',
    description: 'Review the patient medical history and findings.',
  },
  'new-medical-record': {
    label: 'New Medical Record',
    icon: 'plus-square',
    description: 'Capture a fresh clinical note for today or follow-up care.',
  },
  'prescription-history': {
    label: 'Prescription History',
    icon: 'receipt',
    description: 'See the full medication trail already issued to the patient.',
  },
  'new-prescription': {
    label: 'New Prescription',
    icon: 'pill',
    description: 'Write and save a new prescription from the same workspace.',
  },
};

function ClinicalWorkspaceModal({
  activeTab,
  clinicalSuggestions,
  feedback,
  loadingMedical,
  loadingPrescription,
  medicalRecords,
  medicalForm,
  onChangeMedicalForm,
  onChangePrescriptionDate,
  onChangePrescriptionEntry,
  onClose,
  onAddPrescriptionEntry,
  onEditMedicalRecord,
  onEditPrescription,
  onRemovePrescriptionEntry,
  onSubmitMedicalRecord,
  onSubmitPrescription,
  patient,
  prescriptionForm,
  prescriptions,
  editingMedicalId,
  editingPrescriptionId,
  savingMedical,
  savingPrescription,
  setActiveTab,
}) {
  if (!patient) {
    return null;
  }

  const latestMedicalRecord = medicalRecords[0] ?? null;
  const medicalHistoryReference = latestMedicalRecord
    ? [
        latestMedicalRecord.diagnosis,
        latestMedicalRecord.treatmentDone,
        latestMedicalRecord.notes,
      ].filter(Boolean).join(' | ')
    : 'No previous medical history recorded.';
  const patientAgeLabel = calculateAgeLabel(patient.birthDate);
  const prescriptionOptions = {
    medication: mergeOptionLists(COMMON_DENTAL_MEDICATIONS, clinicalSuggestions?.prescription?.medication),
    dosage: mergeOptionLists(STANDARD_DOSAGE_OPTIONS, clinicalSuggestions?.prescription?.dosage),
    frequency: mergeOptionLists(STANDARD_FREQUENCY_OPTIONS, clinicalSuggestions?.prescription?.frequency),
    duration: mergeOptionLists(STANDARD_DURATION_OPTIONS, clinicalSuggestions?.prescription?.duration),
  };

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Clinical Workspace</p>
            <h3>{patient.patientName}</h3>
            <div className="workspace-patient-meta">
              <span>{patient.folderId}</span>
              <span>{patientAgeLabel}</span>
              <span>{formatPhoneNumber(patient.phone)}</span>
              <span>{patient.visitReason}</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="workspace-modal__body">
          <div className="workspace-tab-row">
            {Object.entries(TAB_CONFIG).map(([tabId, tab]) => (
              <button
                className={activeTab === tabId ? 'workspace-tab active' : 'workspace-tab'}
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                type="button"
              >
                <span className="workspace-tab__icon" aria-hidden="true">
                  <PortalIcon className="workspace-tab__icon-svg" name={tab.icon} />
                </span>
                <span className="workspace-tab__content">
                  <strong>{tab.label}</strong>
                  <small>{tab.description}</small>
                </span>
              </button>
            ))}
          </div>

          {feedback ? <p className={feedbackType === 'success' ? 'form-success' : 'form-error'}>{feedback}</p> : null}

          {activeTab === 'medical-records' ? (
            <div className="workspace-history-list">
              {loadingMedical ? <p>Loading medical records...</p> : null}
              {!loadingMedical && !medicalRecords.length ? <p>No medical records found for this patient yet.</p> : null}
              {!loadingMedical && medicalRecords.map((record) => (
                <article className="workspace-form-section workspace-history-record" key={`medical-record-${record.id}`}>
                  <div className="panel-heading workspace-history-record__header">
                    <div>
                      <h4>{record.visitDateLabel}</h4>
                      <div className="workspace-record-meta">
                        <span className="table-counter">{record.dentistName}</span>
                        {record.editedByName ? <span className="workspace-edited-chip">Edited by {record.editedByName}{record.editedAtLabel ? ` on ${record.editedAtLabel}` : ''}</span> : null}
                      </div>
                    </div>
                    <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => onEditMedicalRecord(record)} type="button">
                      <PortalIcon className="workspace-submit-icon" name="edit" />
                      <span>Edit</span>
                    </button>
                  </div>
                  <div className="workspace-history-record__sections">
                    {[
                      ['Complaint', record.presentingComplaint],
                      ['History', record.historyPresentingComplaint],
                      ['Findings', record.examinationFindings],
                      ['Diagnosis', record.diagnosis],
                      ['Treatment done', record.treatmentDone],
                      ['Treatment plan', record.treatmentPlan],
                      ['Investigations', record.investigations],
                      ['Notes', record.notes],
                    ]
                      .filter(([, content]) => Boolean(content))
                      .map(([label, content]) => (
                        <section className="workspace-history-line" key={`${record.id}-${label}`}>
                          <h5>{label}</h5>
                          <ul>
                            <li>{content}</li>
                          </ul>
                        </section>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {activeTab === 'new-medical-record' ? (
            <form className="workspace-form-section" onSubmit={onSubmitMedicalRecord}>
              <div className="form-grid">
                <label className="field-block">
                  <span>Visit date</span>
                  <input name="visit_date" onChange={onChangeMedicalForm} required type="datetime-local" value={medicalForm.visit_date} />
                </label>
                <label className="field-block field-block--wide">
                  <span>Presenting complaint</span>
                  <textarea name="presenting_complaint" onChange={onChangeMedicalForm} placeholder="Enter presenting complaint or main reason for today's visit" required rows={3} value={medicalForm.presenting_complaint} />
                </label>
                <label className="field-block field-block--wide">
                  <span>History of presenting complaint</span>
                  <textarea name="history_presenting_complaint" onChange={onChangeMedicalForm} placeholder="Summarize the complaint history, duration, and progression" required rows={3} value={medicalForm.history_presenting_complaint} />
                </label>
                <label className="field-block field-block--wide">
                  <span>Examination findings</span>
                  <textarea name="examination_findings" onChange={onChangeMedicalForm} placeholder="Enter examination findings and observations" required rows={3} value={medicalForm.examination_findings} />
                </label>
                <label className="field-block field-block--wide">
                  <span>Investigations</span>
                  <textarea name="investigations" onChange={onChangeMedicalForm} placeholder="Enter requested investigations if any" rows={3} value={medicalForm.investigations} />
                </label>
                <label className="field-block">
                  <span>Diagnosis</span>
                  <textarea name="diagnosis" onChange={onChangeMedicalForm} placeholder="Enter diagnosis (e.g., Dental Caries in Molar 30, Periodontitis Stage II)" required rows={3} value={medicalForm.diagnosis} />
                </label>
                <label className="field-block">
                  <span>Treatment</span>
                  <textarea name="treatment_done" onChange={onChangeMedicalForm} placeholder="Enter treatment details (e.g., Amalgam Restoration on Molar 30, Scaling and Root Planing (SRP))" required rows={3} value={medicalForm.treatment_done} />
                </label>
                <label className="field-block field-block--wide">
                  <span>Treatment plan</span>
                  <textarea name="treatment_plan" onChange={onChangeMedicalForm} placeholder="Enter treatment plan or follow-up care guidance" required rows={3} value={medicalForm.treatment_plan} />
                </label>
                <label className="field-block field-block--wide">
                  <span>Medical history (Existing History - Read-only for reference)</span>
                  <textarea className="workspace-readonly-textarea" readOnly rows={4} value={medicalHistoryReference} />
                </label>
                <label className="field-block field-block--wide">
                  <span>Next appointment</span>
                  <input name="next_appointment" onChange={onChangeMedicalForm} type="datetime-local" value={medicalForm.next_appointment} />
                </label>
                <label className="field-block field-block--wide">
                  <span>Notes/Additional Comments</span>
                  <textarea name="notes" onChange={onChangeMedicalForm} placeholder="Enter any other relevant notes or comments" rows={3} value={medicalForm.notes} />
                </label>
              </div>

              <div className="workspace-card__actions">
                <button className="primary-button" disabled={savingMedical} type="submit">
                  <PortalIcon className="workspace-submit-icon" name="plus-square" />
                  <span>{savingMedical ? (editingMedicalId ? 'Updating record...' : 'Saving record...') : (editingMedicalId ? 'Update Record' : 'Save Record')}</span>
                </button>
              </div>
            </form>
          ) : null}

          {activeTab === 'prescription-history' ? (
            <div className="workspace-history-list">
              {loadingPrescription ? <p>Loading prescription history...</p> : null}
              {!loadingPrescription && !prescriptions.length ? <p>No prescriptions found for this patient yet.</p> : null}
              {!loadingPrescription && prescriptions.map((record) => (
                <article className="workspace-form-section workspace-history-record" key={`prescription-${record.id}`}>
                  <div className="panel-heading workspace-history-record__header">
                    <div>
                      <h4>{record.medication}</h4>
                      <div className="workspace-record-meta">
                        <span className="table-counter">{record.datePrescribedLabel}</span>
                        {record.editedByName ? <span className="workspace-edited-chip">Edited by {record.editedByName}{record.editedAtLabel ? ` on ${record.editedAtLabel}` : ''}</span> : null}
                      </div>
                    </div>
                    <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={() => onEditPrescription(record)} type="button">
                      <PortalIcon className="workspace-submit-icon" name="edit" />
                      <span>Edit</span>
                    </button>
                  </div>
                  <p><strong>Dosage:</strong> {record.dosage}</p>
                  <p><strong>Frequency:</strong> {record.frequency}</p>
                  <p><strong>Duration:</strong> {record.duration}</p>
                  {record.instructions ? <p><strong>Instructions:</strong> {record.instructions}</p> : null}
                </article>
              ))}
            </div>
          ) : null}

          {activeTab === 'new-prescription' ? (
            <form className="workspace-form-section" onSubmit={onSubmitPrescription}>
              <div className="form-grid">
                <label className="field-block">
                  <span>Date prescribed</span>
                  <input name="date_prescribed" onChange={onChangePrescriptionDate} required type="datetime-local" value={prescriptionForm.date_prescribed} />
                </label>
              </div>

              <div className="workspace-repeatable-list">
                {prescriptionForm.entries.map((entry, index) => (
                  <section className="workspace-form-section workspace-subsection" key={`prescription-entry-${index}`}>
                    <div className="panel-heading workspace-history-record__header">
                      <div>
                        <h4>Prescription {index + 1}</h4>
                        <p className="table-counter">All entries will be recorded under the same patient and prescription date.</p>
                      </div>
                      {!editingPrescriptionId && prescriptionForm.entries.length > 1 ? (
                        <button
                          className="ghost-button secondary-action--compact workspace-inline-action"
                          onClick={() => onRemovePrescriptionEntry(index)}
                          type="button"
                        >
                          <PortalIcon className="workspace-submit-icon" name="close" />
                          <span>Remove</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="form-grid">
                      <label className="field-block">
                        <span>Medication</span>
                        <select
                          onChange={(event) => {
                            const { value } = event.target;
                            onChangePrescriptionEntry(index, 'medication_option', value);
                            onChangePrescriptionEntry(index, 'medication', value === CUSTOM_PRESCRIPTION_VALUE ? '' : value);
                          }}
                          required
                          value={entry.medication_option ?? ''}
                        >
                          <option value="">Choose medication</option>
                          <option value={CUSTOM_PRESCRIPTION_VALUE}>Other</option>
                          {prescriptionOptions.medication.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {entry.medication_option === CUSTOM_PRESCRIPTION_VALUE ? (
                          <input
                            onChange={(event) => onChangePrescriptionEntry(index, 'medication', event.target.value)}
                            placeholder="Type custom medication"
                            required
                            type="text"
                            value={entry.medication}
                          />
                        ) : null}
                      </label>
                      <label className="field-block">
                        <span>Dosage</span>
                        <select
                          onChange={(event) => {
                            const { value } = event.target;
                            onChangePrescriptionEntry(index, 'dosage_option', value);
                            onChangePrescriptionEntry(index, 'dosage', value === CUSTOM_PRESCRIPTION_VALUE ? '' : value);
                          }}
                          required
                          value={entry.dosage_option ?? ''}
                        >
                          <option value="">Choose dosage</option>
                          <option value={CUSTOM_PRESCRIPTION_VALUE}>Other</option>
                          {prescriptionOptions.dosage.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {entry.dosage_option === CUSTOM_PRESCRIPTION_VALUE ? (
                          <input
                            onChange={(event) => onChangePrescriptionEntry(index, 'dosage', event.target.value)}
                            placeholder="Type custom dosage"
                            required
                            type="text"
                            value={entry.dosage}
                          />
                        ) : null}
                      </label>
                      <label className="field-block">
                        <span>Frequency</span>
                        <select
                          onChange={(event) => {
                            const { value } = event.target;
                            onChangePrescriptionEntry(index, 'frequency_option', value);
                            onChangePrescriptionEntry(index, 'frequency', value === CUSTOM_PRESCRIPTION_VALUE ? '' : value);
                          }}
                          required
                          value={entry.frequency_option ?? ''}
                        >
                          <option value="">Choose frequency</option>
                          <option value={CUSTOM_PRESCRIPTION_VALUE}>Other</option>
                          {prescriptionOptions.frequency.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {entry.frequency_option === CUSTOM_PRESCRIPTION_VALUE ? (
                          <input
                            onChange={(event) => onChangePrescriptionEntry(index, 'frequency', event.target.value)}
                            placeholder="Type custom frequency"
                            required
                            type="text"
                            value={entry.frequency}
                          />
                        ) : null}
                      </label>
                      <label className="field-block">
                        <span>Duration</span>
                        <select
                          onChange={(event) => {
                            const { value } = event.target;
                            onChangePrescriptionEntry(index, 'duration_option', value);
                            onChangePrescriptionEntry(index, 'duration', value === CUSTOM_PRESCRIPTION_VALUE ? '' : value);
                          }}
                          required
                          value={entry.duration_option ?? ''}
                        >
                          <option value="">Choose duration</option>
                          <option value={CUSTOM_PRESCRIPTION_VALUE}>Other</option>
                          {prescriptionOptions.duration.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {entry.duration_option === CUSTOM_PRESCRIPTION_VALUE ? (
                          <input
                            onChange={(event) => onChangePrescriptionEntry(index, 'duration', event.target.value)}
                            placeholder="Type custom duration"
                            required
                            type="text"
                            value={entry.duration}
                          />
                        ) : null}
                      </label>
                      <label className="field-block field-block--wide">
                        <span>Instructions/Notes</span>
                        <textarea
                          onChange={(event) => onChangePrescriptionEntry(index, 'instructions', event.target.value)}
                          placeholder="Specific instructions for the patient"
                          rows={4}
                          value={entry.instructions}
                        />
                      </label>
                    </div>
                  </section>
                ))}
              </div>

              <div className="workspace-card__actions">
                {!editingPrescriptionId ? (
                  <button className="ghost-button secondary-action--compact workspace-inline-action" onClick={onAddPrescriptionEntry} type="button">
                    <PortalIcon className="workspace-submit-icon" name="plus-square" />
                    <span>Add Another Prescription</span>
                  </button>
                ) : null}
                <button className="primary-button" disabled={savingPrescription} type="submit">
                  <PortalIcon className="workspace-submit-icon" name="pill" />
                  <span>{savingPrescription ? (editingPrescriptionId ? 'Updating prescription...' : 'Saving prescription...') : (editingPrescriptionId ? 'Update Prescription' : 'Save Prescription')}</span>
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DentistPatientsPage({
  currentView = 'patients',
  onLoadMedicalRecords,
  onLoadPrescriptions,
  onCreateMedicalRecord,
  onUpdateMedicalRecord,
  onCreatePrescription,
  onUpdatePrescription,
  patients,
}) {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [activePatient, setActivePatient] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('medical-records');
  const [medicalRecords, setMedicalRecords] = React.useState([]);
  const [prescriptions, setPrescriptions] = React.useState([]);
  const [loadingMedical, setLoadingMedical] = React.useState(false);
  const [loadingPrescription, setLoadingPrescription] = React.useState(false);
  const [savingMedical, setSavingMedical] = React.useState(false);
  const [savingPrescription, setSavingPrescription] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [feedbackType, setFeedbackType] = React.useState('error');
  const [clinicalSuggestions, setClinicalSuggestions] = React.useState(EMPTY_CLINICAL_SUGGESTIONS);
  const [editingMedicalId, setEditingMedicalId] = React.useState(null);
  const [editingPrescriptionId, setEditingPrescriptionId] = React.useState(null);
  const [medicalForm, setMedicalForm] = React.useState({
    visit_date: '',
    presenting_complaint: '',
    history_presenting_complaint: '',
    examination_findings: '',
    investigations: '',
    diagnosis: '',
    treatment_done: '',
    treatment_plan: '',
    next_appointment: '',
    notes: '',
  });
  const [prescriptionForm, setPrescriptionForm] = React.useState({
    date_prescribed: '',
    entries: [emptyPrescriptionEntry()],
  });
  const rowsPerPage = 15;

  const config = VIEW_CONFIG[currentView] ?? VIEW_CONFIG.patients;
  const patientItems = patients?.items ?? [];
  const filteredPatients = patientItems.filter((item) => matchesSearch(item, search));
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  async function loadMedicalRecords(patientId) {
    setLoadingMedical(true);
    try {
      const response = await onLoadMedicalRecords(patientId);
      setMedicalRecords(response?.items ?? []);
      setClinicalSuggestions((current) => mergeSuggestionPayload(current, response?.suggestions));
    } finally {
      setLoadingMedical(false);
    }
  }

  async function loadPrescriptions(patientId) {
    setLoadingPrescription(true);
    try {
      const response = await onLoadPrescriptions(patientId);
      setPrescriptions(response?.items ?? []);
      setClinicalSuggestions((current) => mergeSuggestionPayload(current, response?.suggestions));
    } finally {
      setLoadingPrescription(false);
    }
  }

  async function openClinicalWorkspace(patient) {
    const now = nowDateTimeLocalValue();
    setActivePatient(patient);
    setActiveTab(config.defaultTab);
    setFeedback('');
    setFeedbackType('error');
    setEditingMedicalId(null);
    setEditingPrescriptionId(null);
    setClinicalSuggestions(EMPTY_CLINICAL_SUGGESTIONS);
    setMedicalRecords([]);
    setPrescriptions([]);
    setMedicalForm({
      visit_date: now,
      presenting_complaint: patient?.visitReason ?? '',
      history_presenting_complaint: '',
      examination_findings: '',
      investigations: '',
      diagnosis: '',
      treatment_done: '',
      treatment_plan: '',
      next_appointment: now,
      notes: '',
    });
    setPrescriptionForm({
      date_prescribed: now,
      entries: [emptyPrescriptionEntry()],
    });

    if (config.defaultTab === 'medical-records' || config.defaultTab === 'new-medical-record') {
      await loadMedicalRecords(patient.id);
    }

    if (config.defaultTab === 'prescription-history' || config.defaultTab === 'new-prescription') {
      await loadPrescriptions(patient.id);
    }
  }

  async function handleTabChange(tab) {
    setActiveTab(tab);
    setFeedback('');
    setFeedbackType('error');

    if (!activePatient) {
      return;
    }

    if ((tab === 'medical-records' || tab === 'new-medical-record') && !medicalRecords.length) {
      await loadMedicalRecords(activePatient.id);
    }

    if ((tab === 'prescription-history' || tab === 'new-prescription') && !prescriptions.length) {
      await loadPrescriptions(activePatient.id);
    }
  }

  function handleMedicalFormChange(event) {
    const { name, value } = event.target;
    setMedicalForm((current) => ({
      ...current,
      [name]: name.includes('date') || name.includes('appointment') ? value : normalizeLeadingUppercase(value),
    }));
  }

  function handlePrescriptionDateChange(event) {
    const { value } = event.target;
    setPrescriptionForm((current) => ({
      ...current,
      date_prescribed: value,
    }));
  }

  function handlePrescriptionEntryChange(index, field, value) {
    setPrescriptionForm((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => (
        entryIndex === index
          ? { ...entry, [field]: normalizeLeadingUppercase(value) }
          : entry
      )),
    }));
  }

  function serializePrescriptionEntry(entry) {
    return {
      medication: entry.medication,
      dosage: entry.dosage,
      frequency: entry.frequency,
      duration: entry.duration,
      instructions: entry.instructions,
    };
  }

  function handleAddPrescriptionEntry() {
    setPrescriptionForm((current) => ({
      ...current,
      entries: [...current.entries, emptyPrescriptionEntry()],
    }));
  }

  function handleRemovePrescriptionEntry(index) {
    setPrescriptionForm((current) => ({
      ...current,
      entries: current.entries.filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  async function handleMedicalSubmit(event) {
    event.preventDefault();
    if (!activePatient) {
      return;
    }

    setSavingMedical(true);
    setFeedback('');
    setFeedbackType('error');

    try {
      const payload = {
        patient_id: activePatient.id,
        ...medicalForm,
        visit_date: toDateOnly(medicalForm.visit_date),
      };
      const response = editingMedicalId
        ? await onUpdateMedicalRecord({ id: editingMedicalId, ...payload })
        : await onCreateMedicalRecord(payload);
      setMedicalRecords(response?.items ?? []);
      setClinicalSuggestions((current) => mergeSuggestionPayload(current, response?.suggestions));
      setEditingMedicalId(null);
      setFeedbackType('success');
      setFeedback(response?.message ?? (editingMedicalId ? 'Medical record updated successfully.' : 'Medical record saved successfully.'));
      setActiveTab('medical-records');
    } catch (error) {
      setFeedbackType('error');
      setFeedback(error.message);
    } finally {
      setSavingMedical(false);
    }
  }

  async function handlePrescriptionSubmit(event) {
    event.preventDefault();
    if (!activePatient) {
      return;
    }

    setSavingPrescription(true);
    setFeedback('');
    setFeedbackType('error');

    try {
      const basePayload = {
        patient_id: activePatient.id,
        date_prescribed: toDateOnly(prescriptionForm.date_prescribed),
      };
      const payload = editingPrescriptionId
        ? { ...basePayload, ...serializePrescriptionEntry(prescriptionForm.entries[0]) }
        : { ...basePayload, entries: prescriptionForm.entries.map(serializePrescriptionEntry) };
      const response = editingPrescriptionId
        ? await onUpdatePrescription({ id: editingPrescriptionId, ...payload })
        : await onCreatePrescription(payload);
      setPrescriptions(response?.items ?? []);
      setClinicalSuggestions((current) => mergeSuggestionPayload(current, response?.suggestions));
      setEditingPrescriptionId(null);
      setPrescriptionForm({
        date_prescribed: nowDateTimeLocalValue(),
        entries: [emptyPrescriptionEntry()],
      });
      setFeedbackType('success');
      setFeedback(response?.message ?? (editingPrescriptionId ? 'Prescription updated successfully.' : 'Prescription saved successfully.'));
      setActiveTab('prescription-history');
    } catch (error) {
      setFeedbackType('error');
      setFeedback(error.message);
    } finally {
      setSavingPrescription(false);
    }
  }

  function handleEditMedicalRecord(record) {
    setEditingMedicalId(record.id);
    setFeedback('');
    setFeedbackType('error');
    setMedicalForm({
      visit_date: toDateTimeLocalValue(record.visitDate),
      presenting_complaint: record.presentingComplaint ?? '',
      history_presenting_complaint: record.historyPresentingComplaint ?? '',
      examination_findings: record.examinationFindings ?? '',
      investigations: record.investigations ?? '',
      diagnosis: record.diagnosis ?? '',
      treatment_done: record.treatmentDone ?? '',
      treatment_plan: record.treatmentPlan ?? '',
      next_appointment: toDateTimeLocalValue(record.nextAppointment),
      notes: record.notes ?? '',
    });
    setActiveTab('new-medical-record');
  }

  function handleEditPrescription(record) {
    setEditingPrescriptionId(record.id);
    setFeedback('');
    setFeedbackType('error');
    const optionSets = buildPrescriptionOptionSets(clinicalSuggestions);
    setPrescriptionForm({
      date_prescribed: toDateTimeLocalValue(record.datePrescribed),
      entries: [prescriptionEntryFromValues({
        medication: record.medication ?? '',
        dosage: record.dosage ?? '',
        frequency: record.frequency ?? '',
        duration: record.duration ?? '',
        instructions: record.instructions ?? '',
      }, optionSets)],
    });
    setActiveTab('new-prescription');
  }

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">{config.eyebrow}</p>
            <h3>{config.title}</h3>
            <p>{config.body}</p>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search patients</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Patient, folder, old folder, phone..."
              type="text"
              value={search}
            />
          </label>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Patient table</p>
            <h3>All patients</h3>
          </div>
          <span className="table-counter">
            {filteredPatients.length} results | Page {currentPage} of {totalPages}
          </span>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPatients.length ? paginatedPatients.map((patient) => (
                <tr key={`dentist-patient-${patient.id}`}>
                  <td>
                    <strong>{patient.folderId}</strong>
                    {patient.oldFolderId ? <span className="table-subcopy">{patient.oldFolderId}</span> : null}
                  </td>
                  <td>{patient.patientName}</td>
                  <td>{formatPhoneNumber(patient.phone)}</td>
                  <td>{patient.visitReason}</td>
                  <td>{patient.status}</td>
                  <td>
                    <button
                      className="clinical-workspace-button secondary-action--compact"
                      onClick={() => openClinicalWorkspace(patient)}
                      type="button"
                    >
                      Open clinical workspace
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">No patients match the current search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedPatients.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredPatients.length)} of {filteredPatients.length}
          </span>
          <div className="reception-action-row">
            <button
              className="ghost-button secondary-action--compact"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="ghost-button secondary-action--compact"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {activePatient ? (
        <ClinicalWorkspaceModal
        activeTab={activeTab}
        clinicalSuggestions={clinicalSuggestions}
        editingMedicalId={editingMedicalId}
          editingPrescriptionId={editingPrescriptionId}
          feedback={feedback}
          loadingMedical={loadingMedical}
          loadingPrescription={loadingPrescription}
          medicalForm={medicalForm}
          medicalRecords={medicalRecords}
          onChangeMedicalForm={handleMedicalFormChange}
          onChangePrescriptionDate={handlePrescriptionDateChange}
          onChangePrescriptionEntry={handlePrescriptionEntryChange}
          onClose={() => {
            setActivePatient(null);
            setFeedback('');
            setEditingMedicalId(null);
            setEditingPrescriptionId(null);
          }}
          onAddPrescriptionEntry={handleAddPrescriptionEntry}
          onEditMedicalRecord={handleEditMedicalRecord}
          onEditPrescription={handleEditPrescription}
          onRemovePrescriptionEntry={handleRemovePrescriptionEntry}
          onSubmitMedicalRecord={handleMedicalSubmit}
          onSubmitPrescription={handlePrescriptionSubmit}
          patient={activePatient}
          prescriptionForm={prescriptionForm}
          prescriptions={prescriptions}
          savingMedical={savingMedical}
          savingPrescription={savingPrescription}
          setActiveTab={handleTabChange}
        />
      ) : null}
    </>
  );
}
