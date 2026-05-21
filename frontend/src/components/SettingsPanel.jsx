import React from 'react';

function createPreview(value, fallbackValue) {
  if (value instanceof File) {
    return URL.createObjectURL(value);
  }

  return value || fallbackValue || null;
}

export function SettingsPanel({ branding, onSave, saving }) {
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
