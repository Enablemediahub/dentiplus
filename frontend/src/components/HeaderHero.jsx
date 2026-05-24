import React from 'react';
import { PortalIcon } from './PortalIcon';

export function HeaderHero({
  user,
  hero,
  branding,
  currentPageLabel,
  onToggleSidebar,
  theme,
  setTheme,
  onSignOut,
  branchOptions = [],
  selectedBranch = '',
  onSelectBranch = null,
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef(null);
  const heroProfileName = String(user?.last_name || '').trim() || user.name;
  const heroStyle = branding?.heroImage
    ? { '--portal-hero-wallpaper': `url("${branding.heroImage}")` }
    : undefined;

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="portal-header">
      <div className="portal-hero" style={heroStyle}>
        <div className="portal-hero-main">
          <div className="portal-hero-copy">
            <button
              aria-label="Open navigation menu"
              className="sidebar-toggle"
              onClick={onToggleSidebar}
              type="button"
            >
              <PortalIcon className="nav-icon" name="menu" />
            </button>
            <p className="eyebrow">{hero.eyebrow}</p>
            <h2>{heroProfileName}</h2>
            <div className="portal-hero-meta">
              {typeof onSelectBranch === 'function' ? (
                <label className="portal-hero-branch portal-hero-branch-select" htmlFor="portal-branch-select">
                  <span>Branch</span>
                  <select
                    id="portal-branch-select"
                    onChange={(event) => onSelectBranch(event.target.value)}
                    value={selectedBranch}
                  >
                    <option value="">All branches</option>
                    {branchOptions.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="portal-hero-branch">{user.branch || 'Main clinic'}</span>
              )}
              <span className="portal-hero-role">{user.roleLabel}</span>
            </div>
            <div className="portal-hero-page">
              <strong>{currentPageLabel || 'Dashboard'}</strong>
              <p className="header-copy">{hero.title}</p>
              <p className="header-copy">{hero.body}</p>
            </div>
          </div>

          <div className="header-actions portal-hero-actions">
            <button
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="theme-toggle icon-button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              type="button"
            >
              <PortalIcon className="nav-icon" name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>

            <div className="profile-menu-shell" ref={profileMenuRef}>
              <button
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                className="profile-chip"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                type="button"
              >
                <div className="profile-chip-avatar">
                  {user.profileImage ? (
                    <img alt={user.name} className="profile-chip-photo" src={user.profileImage} />
                  ) : (
                    <span className="profile-chip-initial">{user.name.slice(0, 1)}</span>
                  )}
                </div>
                <div className="profile-chip-copy">
                  <strong>{String(user.name || '').split(' ')[0] || 'Profile'}</strong>
                  <span>{user.roleLabel}</span>
                </div>
                <PortalIcon className={isProfileMenuOpen ? 'profile-chevron open' : 'profile-chevron'} name="chevron-down" />
              </button>

              {isProfileMenuOpen ? (
                <div className="profile-dropdown" role="menu">
                  <button
                    className="profile-dropdown-item danger"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onSignOut();
                    }}
                    type="button"
                  >
                    <PortalIcon className="nav-icon" name="logout" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
