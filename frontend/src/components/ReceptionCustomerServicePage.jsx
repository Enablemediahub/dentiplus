import React from 'react';
import { PortalIcon } from './PortalIcon';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

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

function normalizeLeadingUppercase(value) {
  return String(value ?? '').replace(/^([a-z])/, (match) => match.toUpperCase());
}

function normalizeSmsPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) return '+233' + digits.slice(1);
  if (/^\d{9}$/.test(digits)) return '+233' + digits;
  if (/^233\d{9}$/.test(digits)) return '+' + digits;
  if (String(value).trim().startsWith('+') && /^[1-9]\d{9,14}$/.test(digits)) return '+' + digits;
  return null;
}
const QUEUE_OPTIONS = [
  { id: 'clients', label: 'All clients' },
  { id: 'birthdays', label: 'Birthdays | next 30 days' },
  { id: 'appointments', label: 'Upcoming Appointments' },
  { id: 'dormantPatients', label: 'Six-month dental recall' },
  { id: 'followUps', label: 'Follow-up Tracker' },
];

function TemplateModal({ editingTemplate, feedback, form, isOpen, onChange, onClose, onSubmit, saving }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Message template</p>
            <h3>{editingTemplate ? 'Edit template' : 'New template'}</h3>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <label className="field-block">
            <span>Category</span>
            <select name="category" onChange={onChange} value={form.category}>
              <option value="Birthday">Birthday</option>
              <option value="Appointment">Appointment</option>
              <option value="Special">Special</option>
              <option value="FollowUp">Follow-up</option>
              <option value="Holiday">Holiday</option>
            </select>
          </label>
          <label className="field-block">
            <span>Template name</span>
            <input name="template_name" onChange={onChange} required type="text" value={form.template_name} />
          </label>
          <label className="field-block field-block--wide">
            <span>Message</span>
            <textarea name="message_text" onChange={onChange} placeholder="Use {first_name}, {last_name}, or {full_name}" required rows={6} value={form.message_text} />
          </label>
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions">
            <button className="primary-button workspace-inline-action" disabled={saving} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Save Template'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SmsModal({ feedback, form, isOpen, onChange, onClose, onSubmit, recipients, saving, templates, progress, configured, completed }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Customer service SMS</p>
            <h3>Send message</h3>
            <div className="workspace-patient-meta">
              <span>{recipients.length} recipient(s)</span>
            </div>
          </div>
          <button className="ghost-button secondary-action--compact" disabled={saving} onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <label className="field-block">
            <span>Template</span>
            <select name="template_id" disabled={saving} onChange={onChange} value={form.template_id}>
              <option value="">Custom message</option>
              {templates.map((template) => (
                <option key={`template-${template.id}`} value={template.id}>
                  {template.category} | {template.templateName}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block field-block--wide">
            <span>Message</span>
            <textarea name="message" disabled={saving} onChange={onChange} required rows={6} value={form.message} />
          </label>
          <label className="field-block"><span>Recipients per batch</span><select name="batch_size" disabled={saving} onChange={onChange} value={form.batch_size ?? 5}><option value={1}>1</option><option value={5}>5</option><option value={10}>10</option></select></label>
          <p className="table-counter">{recipients.length} unique valid numbers | {Math.ceil(recipients.length / Number(form.batch_size ?? 5))} batches. Keep this page open while sending.</p>
          <p className="table-counter">Personalize with {'{first_name}'}, {'{last_name}'}, or {'{full_name}'}. External contacts use Client as their first name.</p>
          {recipients[0] ? <div className="sms-preview"><strong>Preview for {recipients[0].patientName}</strong><p>{form.message.replaceAll('{first_name}', recipients[0].firstName || 'Client').replaceAll('{last_name}', recipients[0].lastName || '').replaceAll('{full_name}', recipients[0].patientName)}</p></div> : null}
          {configured === false ? <p className="form-error">SMS provider is not configured. Add the Arkesel API key and sender ID before sending.</p> : null}
          <div className="table-wrap sms-recipient-preview">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Queue</th>
                </tr>
              </thead>
              <tbody>
                {recipients.slice(0, 20).map((recipient) => (
                  <tr key={`sms-recipient-${recipient.id}-${recipient.queueType}`}>
                    <td>{recipient.patientName}</td>
                    <td>{formatPhoneNumber(recipient.phone)}</td>
                    <td>{recipient.queueLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recipients.length > 20 ? <p className="table-counter">Showing the first 20 of {recipients.length} recipients. All valid recipients will be included.</p> : null}
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions">
            {progress ? <p role="status" className="sms-progress">{progress}</p> : null}
            <button className="primary-button workspace-inline-action" disabled={saving || completed || !recipients.length || configured === false || !form.message.trim()} type="submit">
              <PortalIcon className="workspace-submit-icon" name="message" />
              <span>{saving ? 'Sending...' : completed ? 'Finished - close to start a new message' : 'Send SMS'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FollowUpModal({ feedback, form, isOpen, onChange, onClose, onSubmit, saving }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div className="workspace-patient-summary">
            <p className="eyebrow eyebrow--modal">Follow-up update</p>
            <h3>{form.patientName}</h3>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">Close</button>
        </div>
        <form className="workspace-modal__body" onSubmit={onSubmit}>
          <label className="field-block">
            <span>Status</span>
            <select name="follow_up_status" onChange={onChange} value={form.follow_up_status}>
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="appointment_scheduled">Appointment scheduled</option>
              <option value="no_response">No response</option>
              <option value="not_interested">Not interested</option>
            </select>
          </label>
          <label className="field-block">
            <span>Contacted via</span>
            <select name="contacted_via" onChange={onChange} value={form.contacted_via}>
              <option value="none">None</option>
              <option value="sms">SMS</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="field-block field-block--wide">
            <span>Notes</span>
            <textarea name="notes" onChange={onChange} rows={5} value={form.notes} />
          </label>
          {feedback ? <p className="form-error">{feedback}</p> : null}
          <div className="workspace-card__actions">
            <button className="primary-button workspace-inline-action" disabled={saving} type="submit">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>{saving ? 'Saving...' : 'Save Follow-up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReceptionCustomerServicePage({
  data,
  onCreateTemplate,
  onDeleteTemplate,
  onSendSms,
  onUpdateFollowUp,
  onUpdateTemplate,
}) {
  const [queueType, setQueueType] = React.useState('clients');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [templateModalOpen, setTemplateModalOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState(null);
  const [templateSaving, setTemplateSaving] = React.useState(false);
  const [templateFeedback, setTemplateFeedback] = React.useState('');
  const [templateForm, setTemplateForm] = React.useState({ category: 'Birthday', template_name: '', message_text: '' });
  const [externalNumbers, setExternalNumbers] = React.useState('');
  const [recipientMode, setRecipientMode] = React.useState('selected');
  const [smsProgress, setSmsProgress] = React.useState('');
  const [campaignResult, setCampaignResult] = React.useState('');
  const [smsCompleted, setSmsCompleted] = React.useState(false);
  const [smsModalOpen, setSmsModalOpen] = React.useState(false);
  const [smsSaving, setSmsSaving] = React.useState(false);
  const [smsFeedback, setSmsFeedback] = React.useState('');
  const [smsForm, setSmsForm] = React.useState({ template_id: '', message: '', batch_size: 5 });
  const [followUpModalOpen, setFollowUpModalOpen] = React.useState(false);
  const [followUpSaving, setFollowUpSaving] = React.useState(false);
  const [followUpFeedback, setFollowUpFeedback] = React.useState('');
  const [followUpForm, setFollowUpForm] = React.useState({ id: 0, patientName: '', follow_up_status: 'pending', contacted_via: 'none', notes: '' });
  const [smsLogPage, setSmsLogPage] = React.useState(1);

  const templates = data?.templates ?? [];
  const queueItems = data?.[queueType] ?? [];
  const smsLogs = data?.smsLogs ?? [];

  const filteredQueueItems = queueItems.filter((item) => [
    item.patientName,
    item.phone,
    item.email,
    item.queueLabel,
    item.status,
    item.note,
    item.followUpStatus,
  ].join(' ').toLowerCase().includes(search.trim().toLowerCase()));

  const totalPages = Math.max(1, Math.ceil(filteredQueueItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedQueueItems = filteredQueueItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const selectedRecipients = queueItems.filter((item) => selectedIds.includes(`${item.id}-${item.queueType ?? queueType}`));
  const externalTokens = externalNumbers.split(/[\s,;]+/).filter(Boolean);
  const rawRecipients = recipientMode === 'all' ? (data?.clients ?? []) : recipientMode === 'external'
    ? externalTokens.map((phone, index) => ({ id: index, patientId: 0, patientName: 'Client', firstName: 'Client', lastName: '', phone, queueType: 'external', queueLabel: 'External number' }))
    : selectedRecipients;
  const uniqueRecipients = new Map();
  let invalidCount = 0;
  rawRecipients.forEach((item) => {
    const phone = normalizeSmsPhone(item.phone);
    if (!phone) { invalidCount++; return; }
    if (!uniqueRecipients.has(phone)) uniqueRecipients.set(phone, { ...item, phone, firstName: item.firstName || item.patientName.split(' ')[0], lastName: item.lastName || '' });
  });
  const smsRecipients = [...uniqueRecipients.values()];
  const duplicateCount = rawRecipients.length - invalidCount - smsRecipients.length;
  function openComposer(mode = 'selected') {
    setRecipientMode(mode); setSmsFeedback(''); setSmsProgress(''); setSmsCompleted(false); setSmsModalOpen(true);
  }
  const smsLogRowsPerPage = 10;
  const smsLogTotalPages = Math.max(1, Math.ceil(smsLogs.length / smsLogRowsPerPage));
  const currentSmsLogPage = clampPage(smsLogPage, smsLogTotalPages);
  const paginatedSmsLogs = smsLogs.slice((currentSmsLogPage - 1) * smsLogRowsPerPage, currentSmsLogPage * smsLogRowsPerPage);

  React.useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [queueType]);

  React.useEffect(() => { setPage(1); }, [search, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setSmsLogPage((current) => clampPage(current, smsLogTotalPages));
  }, [smsLogTotalPages]);

  function toggleSelection(item) {
    const key = `${item.id}-${item.queueType ?? queueType}`;
    setSelectedIds((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]);
  }

  function selectVisibleRows() {
    setSelectedIds((current) => [...new Set([...current, ...paginatedQueueItems.map((item) => `${item.id}-${item.queueType ?? queueType}`)])]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function handleTemplateChange(event) {
    const { name, value } = event.target;
    setTemplateForm((current) => ({ ...current, [name]: name === 'message_text' ? value : normalizeLeadingUppercase(value) }));
  }

  function handleSmsChange(event) {
    const { name, value } = event.target;
    if (name === 'template_id') {
      const template = templates.find((item) => String(item.id) === String(value));
      setSmsForm((current) => ({
        ...current,
        template_id: value,
        message: template?.messageText ?? current.message,
      }));
      return;
    }

    setSmsForm((current) => ({ ...current, [name]: value }));
  }

  function handleFollowUpChange(event) {
    const { name, value } = event.target;
    setFollowUpForm((current) => ({ ...current, [name]: name === 'notes' ? normalizeLeadingUppercase(value) : value }));
  }

  async function submitTemplate(event) {
    event.preventDefault();
    setTemplateSaving(true);
    setTemplateFeedback('');
    try {
      if (editingTemplate) {
        await onUpdateTemplate({ id: editingTemplate.id, ...templateForm });
      } else {
        await onCreateTemplate(templateForm);
      }
      setTemplateModalOpen(false);
      setEditingTemplate(null);
      setTemplateForm({ category: 'Birthday', template_name: '', message_text: '' });
    } catch (error) {
      setTemplateFeedback(error.message);
    } finally {
      setTemplateSaving(false);
    }
  }

  async function submitSms(event) {
    event.preventDefault();
    if (smsSaving || smsCompleted || !smsRecipients.length) return;
    const recipients = smsRecipients;
    const batchSize = Number(smsForm.batch_size || 5);
    const totalBatches = Math.ceil(recipients.length / batchSize);
    setSmsSaving(true); setSmsFeedback('');
    let sent = 0, failed = 0, processed = 0;
    try {
      for (let offset = 0; offset < recipients.length; offset += batchSize) {
        setSmsProgress(`Sending batch ${Math.floor(offset / batchSize) + 1} of ${totalBatches} | ${sent} sent | ${failed} failed`);
        const batch = recipients.slice(offset, offset + batchSize);
        const result = await onSendSms({
          template_id: smsForm.template_id ? Number(smsForm.template_id) : 0,
          message: smsForm.message,
          recipients: batch.map((item) => ({ patient_id: item.patientId, first_name: item.firstName, last_name: item.lastName, phone: item.phone })),
          follow_up_id: recipientMode === 'selected' && queueType === 'followUps' && recipients.length === 1 ? recipients[0].id : 0,
        });
        sent += result.sentCount ?? 0; failed += result.failedCount ?? 0; processed += batch.length;
      }
      const summary = `Campaign complete: ${sent} sent, ${failed} failed across ${totalBatches} batches. See SMS activity for details.`;
      setCampaignResult(summary); setSmsProgress(summary);
    } catch (error) {
      const summary = `Campaign stopped: ${sent} confirmed sent, ${failed} confirmed failed, ${recipients.length - processed} without a confirmed result. Check SMS activity before sending again to avoid duplicates.`;
      setSmsFeedback(error.message); setSmsProgress(summary); setCampaignResult(summary);
    } finally {
      setSmsSaving(false); setSmsCompleted(true); setSelectedIds([]);
      if (recipientMode === 'external') setExternalNumbers('');
    }
  }

  async function submitFollowUp(event) {
    event.preventDefault();
    setFollowUpSaving(true);
    setFollowUpFeedback('');
    try {
      await onUpdateFollowUp(followUpForm);
      setFollowUpModalOpen(false);
    } catch (error) {
      setFollowUpFeedback(error.message);
    } finally {
      setFollowUpSaving(false);
    }
  }

  async function removeTemplate(template) {
    const confirmed = window.confirm(`Delete template "${template.templateName}"?`);
    if (!confirmed) {
      return;
    }

    await onDeleteTemplate({ id: template.id });
  }

  return (
    <>
      <div className="sms-overview">
        {[['All clients', data?.clients?.length ?? 0, 'clients'], ['Birthdays in 30 days', data?.birthdays?.length ?? 0, 'birthdays'], ['Six-month recalls', data?.dormantPatients?.length ?? 0, 'dormantPatients'], ['Saved templates', templates.length, null]].map(([label, count, queue]) => (
          <button key={label} className="module-card sms-stat" type="button" onClick={() => queue ? setQueueType(queue) : document.getElementById('sms-templates')?.scrollIntoView({ behavior: 'smooth' })}>
            <span>{label}</span><strong>{count}</strong><span>{queue ? 'View clients' : 'Manage templates'}</span>
          </button>
        ))}
      </div>
      {campaignResult ? <p className="module-card sms-progress" role="status">{campaignResult}</p> : null}
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Customer service</p>
            <h3>SMS messaging & client care</h3>
            <p>Send personalized messages to your clients or external numbers. Plan birthday wishes and six-month dental reminders, using your saved templates.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="primary-button workspace-inline-action" onClick={() => setTemplateModalOpen(true)} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>New template</span>
            </button>
            <button className="primary-button workspace-inline-action" disabled={!data?.clients?.length} onClick={() => openComposer('all')} type="button">
              Message all clients ({data?.clients?.length ?? 0})
            </button>
            <button className="ghost-button workspace-inline-action" disabled={!paginatedQueueItems.length} onClick={selectVisibleRows} type="button">
              <PortalIcon className="workspace-submit-icon" name="patients" />
              <span>Select this page</span>
            </button>
            <button className="ghost-button workspace-inline-action" disabled={!filteredQueueItems.length} onClick={() => setSelectedIds(filteredQueueItems.map((item) => `${item.id}-${item.queueType ?? queueType}`))} type="button">Select all results ({filteredQueueItems.length})</button>
            <button className="ghost-button workspace-inline-action" disabled={!selectedRecipients.length} onClick={clearSelection} type="button">
              <PortalIcon className="workspace-submit-icon" name="close" />
              <span>Clear selection</span>
            </button>
            <button className="ghost-button workspace-inline-action" disabled={!selectedRecipients.length} onClick={() => openComposer('selected')} type="button">
              <PortalIcon className="workspace-submit-icon" name="message" />
              <span>{selectedRecipients.length > 1 ? `Send Bulk SMS (${selectedRecipients.length})` : 'Send SMS'}</span>
            </button>
          </div>
        </div>

        <div className="sms-queue-tabs" aria-label="Recipient lists">
          {QUEUE_OPTIONS.map((option) => <button key={option.id} className={queueType === option.id ? 'primary-button' : 'ghost-button'} onClick={() => setQueueType(option.id)} type="button">{option.label}</button>)}
        </div>
        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search clients</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Patient, phone, queue, notes..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Queue</span>
            <select onChange={(event) => setQueueType(event.target.value)} value={queueType}>
              {QUEUE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
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

      <section className="module-card sms-external">
        <div><p className="eyebrow">Message any number</p><h3>External recipients</h3><p>Paste numbers separated by spaces, commas, or new lines. Use Ghana local numbers or international numbers with +country code.</p></div>
        <label className="field-block"><span>Phone numbers outside your database</span><textarea rows={3} value={externalNumbers} onChange={(event) => setExternalNumbers(event.target.value)} placeholder="0241234567, +233201234567" /></label>
        <button className="primary-button" disabled={!externalTokens.length} onClick={() => openComposer('external')} type="button">Compose external SMS ({externalTokens.length})</button>
      </section>
      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Client recipients | {selectedRecipients.length} selected across pages</p>
            <h3>{QUEUE_OPTIONS.find((item) => item.id === queueType)?.label ?? 'Queue'}</h3>
          </div>
          <span className="table-counter">
            {filteredQueueItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Patient</th>
                <th>Phone</th>
                <th>{queueType === 'clients' ? 'Email' : queueType === 'dormantPatients' ? 'Last completed visit' : 'Date'}</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedQueueItems.length ? paginatedQueueItems.map((item) => {
                const key = `${item.id}-${item.queueType ?? queueType}`;
                const followUpStatus = item.followUpStatus ?? item.status;
                return (
                  <tr key={`customer-queue-${key}`}>
                    <td>
                      <input aria-label={`Select ${item.patientName}`} checked={selectedIds.includes(key)} onChange={() => toggleSelection(item)} type="checkbox" />
                    </td>
                    <td>
                      <strong>{item.patientName}</strong>
                      <span className="table-subcopy">{item.note || item.queueLabel}</span>
                    </td>
                    <td>{formatPhoneNumber(item.phone)}</td>
                    <td>{queueType === 'clients' ? item.email || '-' : item.eventDateLabel || item.lastAppointmentLabel}</td>
                    <td>{queueType === 'clients' ? normalizeSmsPhone(item.phone) ? 'Ready to message' : 'Missing or invalid phone' : followUpStatus}</td>
                    <td>
                      <div className="table-action-row">
                        <button className="ghost-button secondary-action--compact workspace-inline-action" disabled={!normalizeSmsPhone(item.phone)} onClick={() => {
                          setSelectedIds([key]);
                          openComposer('selected');
                        }} type="button">
                          SMS
                        </button>
                        {queueType === 'followUps' ? (
                          <button className="clinical-workspace-button secondary-action--compact" onClick={() => {
                            setFollowUpForm({
                              id: item.id,
                              patientName: item.patientName,
                              follow_up_status: String(item.followUpStatus ?? 'Pending').toLowerCase().replace(/\s+/g, '_'),
                              contacted_via: String(item.contactedVia ?? 'None').toLowerCase(),
                              notes: item.notes ?? '',
                            });
                            setFollowUpModalOpen(true);
                          }} type="button">
                            Update
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="6">No records match the current search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedQueueItems.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredQueueItems.length)} of {filteredQueueItems.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            <button className="ghost-button secondary-action--compact" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Next</button>
          </div>
        </div>
      </section>

      <section className="module-card" id="sms-templates">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Message templates</p>
            <h3>Saved SMS templates</h3>
          </div>
          <span className="table-counter">{templates.length} template(s)</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Name</th>
                <th>Message</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {templates.length ? templates.map((template) => (
                <tr key={`template-${template.id}`}>
                  <td>{template.category}</td>
                  <td>{template.templateName}</td>
                  <td>{template.messageText}</td>
                  <td>
                    <div className="table-action-row">
                      <button className="ghost-button secondary-action--compact" onClick={() => {
                        setEditingTemplate(template);
                        setTemplateForm({
                          category: template.category,
                          template_name: template.templateName,
                          message_text: template.messageText,
                        });
                        setTemplateModalOpen(true);
                      }} type="button">Edit</button>
                      <button className="danger-button secondary-action--compact" onClick={() => removeTemplate(template)} type="button">Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4">No templates have been saved yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">SMS activity</p>
            <h3>Recent SMS logs</h3>
          </div>
          <span className="table-counter">
            {smsLogs.length} logs | Page {currentSmsLogPage} of {smsLogTotalPages}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Message</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSmsLogs.length ? paginatedSmsLogs.map((log) => (
                <tr key={`sms-log-${log.id}`}>
                  <td>{formatPhoneNumber(log.phone)}</td>
                  <td>{log.message}</td>
                  <td>{log.status}</td>
                  <td>{log.createdAtLabel}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4">No SMS logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedSmsLogs.length ? (currentSmsLogPage - 1) * smsLogRowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentSmsLogPage * smsLogRowsPerPage, smsLogs.length)} of {smsLogs.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentSmsLogPage <= 1} onClick={() => setSmsLogPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
            <button className="ghost-button secondary-action--compact" disabled={currentSmsLogPage >= smsLogTotalPages} onClick={() => setSmsLogPage((value) => Math.min(smsLogTotalPages, value + 1))} type="button">Next</button>
          </div>
        </div>
      </section>

      <TemplateModal
        editingTemplate={editingTemplate}
        feedback={templateFeedback}
        form={templateForm}
        isOpen={templateModalOpen}
        onChange={handleTemplateChange}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
          setTemplateFeedback('');
          setTemplateForm({ category: 'Birthday', template_name: '', message_text: '' });
        }}
        onSubmit={submitTemplate}
        saving={templateSaving}
      />

      <SmsModal
        feedback={[smsFeedback, invalidCount ? `${invalidCount} invalid or missing numbers excluded.` : '', duplicateCount ? `${duplicateCount} duplicate numbers removed.` : ''].filter(Boolean).join(' ')}
        progress={smsProgress}
        completed={smsCompleted}
        configured={data?.smsConfigured}
        form={smsForm}
        isOpen={smsModalOpen}
        onChange={handleSmsChange}
        onClose={() => {
          if (smsSaving) return;
          setSmsModalOpen(false);
          setSmsFeedback('');
          setSmsForm({ template_id: '', message: '', batch_size: 5 });
        }}
        onSubmit={submitSms}
        recipients={smsRecipients}
        saving={smsSaving}
        templates={templates}
      />

      <FollowUpModal
        feedback={followUpFeedback}
        form={followUpForm}
        isOpen={followUpModalOpen}
        onChange={handleFollowUpChange}
        onClose={() => {
          setFollowUpModalOpen(false);
          setFollowUpFeedback('');
        }}
        onSubmit={submitFollowUp}
        saving={followUpSaving}
      />
    </>
  );
}
