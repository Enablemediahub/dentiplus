import React from 'react';

export function SessionRestore() {
  return (
    <main className="app-shell">
      <section className="login-shell login-shell-modern boot-restore-shell">
        <div className="brand-panel">
          <div className="boot-restore-logo-wrap">
            <div className="brand-mark brand-mark--large">
              <img alt="Dentiplus logo" className="brand-logo brand-logo--restore" src="/edental-dentiplus-logo.png" />
            </div>
          </div>
          <h1>Restoring your session.</h1>
          <p>Checking the API and your stored Dentiplus login token.</p>
          <footer className="app-credit-footer">Developed and Designed by DALE QUIST [Enable Technologies]</footer>
        </div>
      </section>
    </main>
  );
}
