import React from 'react';

function normalizeBranchName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createPreview(value, fallbackValue) {
  if (value instanceof File) {
    return URL.createObjectURL(value);
  }

  return value || fallbackValue || null;
}

export function SettingsPanel({ branding, branches = [], onCreateBranch, onSave, saving }) {
  const [form, setForm] = React.useState({
    clinicName: branding?.clinicName ?? '',
    address: branding?.address ?? '',
    phone: branding?.phone ?? '',
    email: branding?.email ?? '',
    loginWallpaper: null,
    heroImage: null,
    sidebarLogo: null,
  });
  const [feedback, setFeedback] = React.useState({ type: '', message: '' });
  const [branchName, setBranchName] = React.useState('');
  const [branchSaving, setBranchSaving] = React.useState(false);
  const [branchFeedback, setBranchFeedback] = React.useState({ type: '', message: '' });

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      clinicName: branding?.clinicName ?? '',
      address: branding?.address ?? '',
      phone: branding?.phone ?? '',
      email: branding?.email ?? '',
    }));
  }, [branding?.clinicName, branding?.address, branding?.phone, branding?.email]);

  const loginPreview = React.useMemo(
    () => createPreview(form.loginWallpaper, branding?.loginWallpaper),
    [form.loginWallpaper, branding?.loginWallpaper]
  );
  const heroPreview = React.useMemo(
    () => createPreview(form.heroImage, branding?.heroImage ?? branding?.dashboardWallpaper),
    [form.heroImage, branding?.heroImage, branding?.dashboardWallpaper]
  );
  const sidebarPreview = React.useMemo(
    () => createPreview(form.sidebarLogo, branding?.sidebarLogo),
    [form.sidebarLogo, branding?.sidebarLogo]
  );

  React.useEffect(() => () => {
    if (form.loginWallpaper instanceof File) {
      URL.revokeObjectURL(loginPreview);
    }
    if (form.heroImage instanceof File) {
      URL.revokeObjectURL(heroPreview);
    }
    if (form.sidebarLogo instanceof File) {
      URL.revokeObjectURL(sidebarPreview);
    }
  }, [form.heroImage, form.loginWallpaper, form.sidebarLogo, heroPreview, loginPreview, sidebarPreview]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateFile(event) {
    const { files, name } = event.target;
    setForm((current) => ({ ...current, [name]: files?.[0] ?? null }));
  }

  async function handleCreateBranch(event) {
    event.preventDefault();
    setBranchFeedback({ type: '', message: '' });

    const normalizedName = normalizeBranchName(branchName);
    if (!normalizedName) {
      setBranchFeedback({ type: 'error', message: 'Branch name is required.' });
      return;
    }

    setBranchSaving(true);

    try {
      await onCreateBranch({ name: normalizedName });
      setBranchName('');
      setBranchFeedback({ type: 'success', message: 'Branch added successfully.' });
    } catch (error) {
      setBranchFeedback({ type: 'error', message: error.message });
    } finally {
      setBranchSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await onSave(form);
      setForm((current) => ({
        ...current,
        loginWallpaper: null,
        heroImage: null,
        sidebarLogo: null,
      }));
      setFeedback({ type: 'success', message: 'Settings saved successfully.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <section className="panel workspace-card settings-panel">
      <div className="panel-heading workspace-card__header">
        <div>
          <p className="eyebrow">Admin branding</p>
          <h3>Clinic settings and hero media</h3>
          <p>Update the clinic identity details and upload the login wallpaper plus the dashboard hero image from one place.</p>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field-block">
            <span>Clinic name</span>
            <input name="clinicName" onChange={updateField} type="text" value={form.clinicName} />
          </label>

          <label className="field-block">
            <span>Clinic email</span>
            <input name="email" onChange={updateField} type="email" value={form.email} />
          </label>

          <label className="field-block">
            <span>Clinic phone</span>
            <input name="phone" onChange={updateField} type="text" value={form.phone} />
          </label>

          <label className="field-block field-block--wide">
            <span>Clinic address</span>
            <textarea name="address" onChange={updateField} rows={4} value={form.address} />
          </label>
        </div>

        <div className="workspace-form-section">
          <div className="panel-heading workspace-card__header">
            <div>
              <p className="eyebrow">Branch control</p>
              <h3>Branch directory</h3>
              <p>Add a branch here once, then reuse it everywhere in staff management and branch-scoped records.</p>
            </div>
          </div>

          <div className="frontdesk-command-grid">
            <div className="frontdesk-highlight">
              <span>Tracked branches</span>
              <strong>{branches.length}</strong>
              <p>Live branch names available for admin filters and staff assignment.</p>
            </div>
            <div className="frontdesk-highlight">
              <span>Latest branch source</span>
              <strong>Database table</strong>
              <p>New branch entries are written directly into the `branches` table with their own IDs.</p>
            </div>
          </div>

          <form className="reception-filter-strip" onSubmit={handleCreateBranch}>
            <label className="field-block reception-inline-field reception-search-field">
              <span>Add branch</span>
              <input
                onChange={(event) => setBranchName(event.target.value)}
                placeholder="Enter branch name, e.g. Spintex"
                type="text"
                value={branchName}
              />
            </label>
            <div className="workspace-card__actions reception-action-row reception-action-row--end">
              <button className="primary-button workspace-inline-action" disabled={branchSaving} type="submit">
                {branchSaving ? 'Adding branch...' : 'Add branch'}
              </button>
            </div>
          </form>

          {branchFeedback.message ? (
            <p className={branchFeedback.type === 'error' ? 'form-error' : 'form-success'}>{branchFeedback.message}</p>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch ID</th>
                  <th>Branch name</th>
                </tr>
              </thead>
              <tbody>
                {branches.length ? branches.map((branch) => (
                  <tr key={`settings-branch-${branch.id}`}>
                    <td><strong>{branch.id}</strong></td>
                    <td>{branch.name}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2">No branches have been added yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="settings-media-grid">
          <label className="media-upload-card">
            <span className="media-upload-card__label">Sidebar business logo</span>
            <span className="media-upload-card__copy">Used inside the original round sidebar logo frame for your clinic brand.</span>
            <input accept="image/png,image/jpeg,image/webp" name="sidebarLogo" onChange={updateFile} type="file" />
            {sidebarPreview ? (
              <div className="media-preview media-preview--logo">
                <div className="brand-mark brand-mark--preview">
                  <img alt="Sidebar logo preview" className="brand-logo brand-logo--preview" src={sidebarPreview} />
                </div>
              </div>
            ) : (
              <div className="media-preview media-preview--empty">No sidebar logo uploaded yet.</div>
            )}
          </label>

          <label className="media-upload-card">
            <span className="media-upload-card__label">Login wallpaper</span>
            <span className="media-upload-card__copy">Shown on the sign-in screen before users enter the portal.</span>
            <input accept="image/png,image/jpeg,image/webp" name="loginWallpaper" onChange={updateFile} type="file" />
            {loginPreview ? (
              <div className="media-preview" style={{ backgroundImage: `url("${loginPreview}")` }} />
            ) : (
              <div className="media-preview media-preview--empty">No login wallpaper uploaded yet.</div>
            )}
          </label>

          <label className="media-upload-card">
            <span className="media-upload-card__label">Dashboard hero image</span>
            <span className="media-upload-card__copy">Used behind the top hero area across the portal after sign-in.</span>
            <input accept="image/png,image/jpeg,image/webp" name="heroImage" onChange={updateFile} type="file" />
            {heroPreview ? (
              <div className="media-preview" style={{ backgroundImage: `url("${heroPreview}")` }} />
            ) : (
              <div className="media-preview media-preview--empty">No hero image uploaded yet.</div>
            )}
          </label>
        </div>

        {feedback.message ? (
          <p className={feedback.type === 'error' ? 'form-error' : 'form-success'}>{feedback.message}</p>
        ) : null}

        <div className="workspace-card__actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving settings...' : 'Save settings'}
          </button>
        </div>
      </form>
    </section>
  );
}
