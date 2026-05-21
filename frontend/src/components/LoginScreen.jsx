import React, { useState } from 'react';

export function LoginScreen({ onLogin, loading, error, branding, theme, setTheme }) {
  const [credentials, setCredentials] = useState({
    login: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setCredentials((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onLogin(credentials);
  }

  const wallpaperStyle = branding?.loginWallpaper
    ? { '--login-wallpaper': `url("${branding.loginWallpaper}")` }
    : undefined;

  return (
    <main className="app-shell">
      <section className="login-shell login-shell-modern" style={wallpaperStyle}>
        <div className="brand-panel brand-panel-modern">
          <div className="login-hero-copy">
            <div className="login-hero-logo-wrap">
              <div className="brand-mark brand-mark--login">
                <img alt="Dentiplus logo" className="brand-logo brand-logo--login" src="/edental-dentiplus-logo.png" />
              </div>
            </div>
            <h1>eDENTAL CLINICS</h1>
            <p className="login-hero-credit">
              Developed and Designed by DALE QUIST [Enable Technologies]
            </p>
          </div>
        </div>

        <div className="login-panel">
          <div className="panel-top">
            <div>
              <p className="eyebrow">Secure Access</p>
              <h2>Dentiplus Portal</h2>
              <p className="login-subtitle">Sign in to continue to the eDENTAL CLINICS workspace.</p>
            </div>
            <button
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`theme-toggle login-theme-toggle ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              type="button"
            >
              <span className="login-theme-toggle-track">
                <span className="login-theme-toggle-thumb" />
              </span>
            </button>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-brand-stack">
              <div>
                <span className="login-brand-company">{branding?.clinicName ?? 'eDENTAL CLINICS'}</span>
                <span>{branding?.email ?? 'Smart dental management software'}</span>
              </div>
            </div>

            <label>
              Username or Email
              <input
                autoComplete="username"
                name="login"
                type="text"
                value={credentials.login}
                onChange={updateField}
                placeholder="user@dentiplus.local"
              />
            </label>

            <label>
              Password
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={updateField}
                  placeholder="Enter your password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button className="primary-button" disabled={loading} type="submit">
              {loading ? 'Signing in...' : 'Open portal'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
