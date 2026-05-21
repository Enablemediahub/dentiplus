import React from 'react';
import { PortalIcon } from './PortalIcon';

export function Sidebar({
  branding,
  role,
  navSections,
  currentView,
  currentUser,
  isMobileOpen,
  onNavigate,
  onClose,
  onSignOut,
}) {
  return (
    <>
      <aside className={`sidebar ${isMobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark brand-mark--sidebar">
            <img alt="eDENTAL Clinics logo" className="brand-logo brand-logo--sidebar" src={branding?.sidebarLogo ?? '/edental-clinics-logo.jpeg'} />
          </div>
          <div className="sidebar-brand-copy">
            <strong>{branding?.clinicName ?? 'eDENTAL CLINICS'}</strong>
            <span>{role} operations portal</span>
          </div>
          <button
            aria-label="Close navigation menu"
            className="sidebar-mobile-close"
            onClick={onClose}
            type="button"
          >
            <PortalIcon className="nav-icon" name="close" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <section className="sidebar-nav-section" key={section.title}>
              <p className="sidebar-nav-title">{section.title}</p>
              <div className="sidebar-nav-group">
                {section.items.map((item) => (
                  <button
                    className={currentView === item.id ? 'nav-item active' : 'nav-item'}
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    type="button"
                  >
                    <PortalIcon className="nav-icon" name={item.icon} />
                    <span>{item.navLabel ?? item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footnote">
          <div className="sidebar-footnote-head">
            <PortalIcon className="sidebar-footnote-icon" name="shield" />
            <span>Signed in as</span>
          </div>
          <strong>{currentUser.roleLabel}</strong>
          <span className="sidebar-user__name">{currentUser.name}</span>
          <span className="sidebar-user__meta">{currentUser.branch || 'Main clinic'}</span>
          <button className="nav-item sidebar-signout" onClick={onSignOut} type="button">
            <PortalIcon className="nav-icon" name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {isMobileOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="sidebar-overlay"
          onClick={onClose}
          type="button"
        />
      ) : null}
    </>
  );
}
