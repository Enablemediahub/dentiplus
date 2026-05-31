import React from 'react';
import { PortalIcon } from './PortalIcon';

function clampPage(page, totalPages) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

function matchesSearch(item, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  return [
    item.name,
    item.username,
    item.email,
    item.phone,
    item.role,
    item.branch,
    item.status,
  ].join(' ').toLowerCase().includes(trimmed);
}

function createStaffForm(item) {
  return {
    staffId: item?.staffId ?? 0,
    firstName: item?.firstName ?? '',
    lastName: item?.lastName ?? '',
    otherNames: item?.otherNames ?? '',
    phone: item?.phone ?? '',
    email: item?.email ?? '',
    username: item?.username ?? '',
    role: item?.role ?? 'Receptionist',
    branch: item?.branch ?? '',
    isActive: item?.isActive ?? true,
    password: '',
    profileImage: null,
    profileImagePreview: item?.profileImage ?? '',
  };
}

function StaffManagementModal({
  currentUserId,
  deleting,
  feedback,
  form,
  isOpen,
  onChange,
  onClose,
  onDelete,
  onResetPassword,
  onSave,
  resetPassword,
  saving,
  setResetPassword,
  showNewPassword,
  showPassword,
  toggleNewPassword,
  togglePassword,
  branches,
}) {
  if (!isOpen || !form) {
    return null;
  }

  const editing = form.staffId > 0;

  return (
    <div className="workspace-modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="workspace-modal__header">
          <div>
            <p className="eyebrow eyebrow--modal">User and staff management</p>
            <h3>{editing ? 'Manage staff account' : 'Create staff account'}</h3>
            <p>Edit profile information, upload profile pictures, reset passwords, and control who stays active on the platform.</p>
          </div>
          <button className="ghost-button secondary-action--compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="workspace-modal__body">
          <div className="staff-management-layout">
            <aside className="workspace-form-section staff-photo-panel">
              <div className="staff-photo-preview">
                {form.profileImagePreview ? (
                  <img alt={`${form.firstName} ${form.lastName}`.trim() || 'Staff profile'} className="staff-photo-preview__image" src={form.profileImagePreview} />
                ) : (
                  <span className="staff-photo-preview__initial">
                    {(form.firstName || form.lastName || form.username || 'S').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <label className="field-block">
                <span>Profile picture</span>
                <input accept="image/png,image/jpeg,image/webp" name="profileImage" onChange={onChange} type="file" />
              </label>
              <div className="staff-photo-note">
                <span>Hero profile icon</span>
                <strong>{editing ? 'Live linked' : 'Ready on save'}</strong>
                <p>The uploaded profile image will appear on the signed-in hero profile chip for that user.</p>
              </div>
            </aside>

            <div className="staff-management-main">
              <form className="workspace-repeatable-list" onSubmit={onSave}>
                <div className="workspace-form-section">
                  <h4>Profile</h4>
                  <div className="form-grid staff-profile-grid">
                    <label className="field-block">
                      <span>First name</span>
                      <input name="firstName" onChange={onChange} required type="text" value={form.firstName} />
                    </label>
                    <label className="field-block">
                      <span>Last name</span>
                      <input name="lastName" onChange={onChange} required type="text" value={form.lastName} />
                    </label>
                    <label className="field-block">
                      <span>Other names</span>
                      <input name="otherNames" onChange={onChange} type="text" value={form.otherNames} />
                    </label>
                    <label className="field-block">
                      <span>Phone</span>
                      <input name="phone" onChange={onChange} required type="text" value={form.phone} />
                    </label>
                    <label className="field-block">
                      <span>Email</span>
                      <input name="email" onChange={onChange} required type="email" value={form.email} />
                    </label>
                    <label className="field-block">
                      <span>Username</span>
                      <input name="username" onChange={onChange} required type="text" value={form.username} />
                    </label>
                    <label className="field-block">
                      <span>Role</span>
                      <select name="role" onChange={onChange} value={form.role}>
                        <option value="CEO">CEO</option>
                        <option value="Dentist">Dentist</option>
                        <option value="Receptionist">Receptionist</option>
                        <option value="Nurse">Nurse</option>
                        <option value="Accountant">Accountant</option>
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Branch</span>
                      <select name="branch" onChange={onChange} required value={form.branch}>
                        <option value="">Select branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.name}>{branch.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Status</span>
                      <select name="isActive" onChange={onChange} value={form.isActive ? '1' : '0'}>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </label>
                    {!editing ? (
                      <label className="field-block">
                        <span>Initial password</span>
                        <div className="password-field">
                          <input name="password" onChange={onChange} required type={showPassword ? 'text' : 'password'} value={form.password} />
                          <button
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="password-toggle password-toggle--icon"
                            onClick={togglePassword}
                            type="button"
                          >
                            <PortalIcon className="nav-icon" name={showPassword ? 'eye-off' : 'eye'} />
                          </button>
                        </div>
                      </label>
                    ) : null}
                  </div>
                </div>

                {editing ? (
                  <div className="workspace-form-section">
                    <h4>Security</h4>
                    <div className="form-grid staff-security-grid">
                      <label className="field-block">
                        <span>New password</span>
                        <div className="password-field">
                          <input
                            onChange={(event) => setResetPassword(event.target.value)}
                            placeholder="Enter a new password"
                            type={showNewPassword ? 'text' : 'password'}
                            value={resetPassword}
                          />
                          <button
                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            className="password-toggle password-toggle--icon"
                            onClick={toggleNewPassword}
                            type="button"
                          >
                            <PortalIcon className="nav-icon" name={showNewPassword ? 'eye-off' : 'eye'} />
                          </button>
                        </div>
                      </label>
                      <div className="staff-security-note">
                        <span>Password reset</span>
                        <strong>Admin controlled</strong>
                        <p>Set a fresh password here and push it instantly for this user.</p>
                      </div>
                    </div>
                    <div className="workspace-card__actions">
                      <button className="ghost-button workspace-inline-action" disabled={saving || resetPassword.trim().length < 6} onClick={onResetPassword} type="button">
                        <PortalIcon className="workspace-submit-icon" name="shield" />
                        <span>Reset password</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {feedback ? <p className="form-error">{feedback}</p> : null}

                <div className="workspace-card__actions workspace-card__actions--between">
                  {editing ? (
                    <button
                      className="danger-button workspace-inline-action"
                      disabled={saving || deleting || Number(currentUserId) === Number(form.staffId)}
                      onClick={onDelete}
                      type="button"
                    >
                      <PortalIcon className="workspace-submit-icon" name="close" />
                      <span>{deleting ? 'Deleting...' : Number(currentUserId) === Number(form.staffId) ? 'Cannot delete current user' : 'Delete user'}</span>
                    </button>
                  ) : <span />}
                  <button className="primary-button workspace-inline-action" disabled={saving} type="submit">
                    <PortalIcon className="workspace-submit-icon" name="plus-square" />
                    <span>{saving ? 'Saving...' : editing ? 'Save changes' : 'Create account'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminStaffPage({
  branches = [],
  currentUserId,
  onCreateStaff,
  onDeleteStaff,
  onNavigate,
  onResetStaffPassword,
  onUpdateStaff,
  staff,
}) {
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [page, setPage] = React.useState(1);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(null);
  const [feedback, setFeedback] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [resetPassword, setResetPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);

  const items = staff?.items ?? [];
  const roles = Array.from(new Set(items.map((item) => item.role).filter(Boolean)));

  const filteredItems = items.filter((item) => {
    const normalizedStatus = String(item.status ?? '').toLowerCase();
    const matchesRole = roleFilter === 'all' || String(item.role ?? '') === roleFilter;
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    return matchesRole && matchesStatus && matchesSearch(item, search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentPage = clampPage(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, rowsPerPage]);

  React.useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  function openCreateModal() {
    setFeedback('');
    setResetPassword('');
    setShowPassword(false);
    setShowNewPassword(false);
    setForm(createStaffForm());
    setModalOpen(true);
  }

  function openEditModal(item) {
    setFeedback('');
    setResetPassword('');
    setShowPassword(false);
    setShowNewPassword(false);
    setForm(createStaffForm(item));
    setModalOpen(true);
  }

  function handleChange(event) {
    const { name, value, files } = event.target;

    if (name === 'profileImage') {
      const file = files?.[0] ?? null;
      setForm((current) => (
        current
          ? {
              ...current,
              profileImage: file,
              profileImagePreview: file ? URL.createObjectURL(file) : current.profileImagePreview,
            }
          : current
      ));
      return;
    }

    setForm((current) => (
      current
        ? {
            ...current,
            [name]: name === 'isActive' ? value === '1' : value,
          }
        : current
    ));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!form) {
      return;
    }

    const payload = new FormData();
    payload.append('staff_id', String(form.staffId || 0));
    payload.append('first_name', form.firstName);
    payload.append('last_name', form.lastName);
    payload.append('other_names', form.otherNames);
    payload.append('phone', form.phone);
    payload.append('email', form.email);
    payload.append('username', form.username);
    payload.append('role', form.role);
    payload.append('branch', form.branch);
    payload.append('is_active', form.isActive ? '1' : '0');

    if (form.password) {
      payload.append('password', form.password);
    }

    if (form.profileImage instanceof File) {
      payload.append('profile_image', form.profileImage);
    }

    setSaving(true);
    setFeedback('');

    try {
      if (form.staffId > 0) {
        await onUpdateStaff(payload);
      } else {
        await onCreateStaff(payload);
      }
      setModalOpen(false);
      setForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!form?.staffId) {
      return;
    }

    setSaving(true);
    setFeedback('');

    try {
      await onResetStaffPassword({
        staff_id: form.staffId,
        new_password: resetPassword,
      });
      setResetPassword('');
      setFeedback('Password reset successfully.');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form?.staffId) {
      return;
    }

    const confirmed = window.confirm(`Delete ${form.firstName} ${form.lastName} from the platform? This removes the linked user account too.`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback('');

    try {
      await onDeleteStaff({ staff_id: form.staffId });
      setModalOpen(false);
      setForm(null);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="module-card reception-toolbar-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Users and staff</p>
            <h3>Staff directory control surface</h3>
            <p>Manage usernames, reset passwords, activate or deactivate users, upload profile pictures, and keep branch ownership clean from one popup workflow.</p>
          </div>
          <div className="workspace-card__actions reception-action-row reception-action-row--end">
            <button className="ghost-button workspace-inline-action" onClick={() => onNavigate('database')} type="button">
              <PortalIcon className="workspace-submit-icon" name="layers" />
              <span>Open database view</span>
            </button>
            <button className="primary-button workspace-inline-action" onClick={openCreateModal} type="button">
              <PortalIcon className="workspace-submit-icon" name="plus-square" />
              <span>Add user</span>
            </button>
          </div>
        </div>

        <div className="reception-filter-strip">
          <label className="field-block reception-inline-field reception-search-field">
            <span>Search staff</span>
            <PortalIcon className="reception-search-icon" name="search" />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Name, username, email, role, branch..." type="text" value={search} />
          </label>
          <label className="field-block reception-inline-field">
            <span>Role</span>
            <select onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="field-block reception-inline-field">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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

      <section className="module-card">
        <div className="panel-heading workspace-card__header">
          <div>
            <p className="eyebrow">Staff table</p>
            <h3>Current directory</h3>
          </div>
          <span className="table-counter">
            {filteredItems.length} results | Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length ? paginatedItems.map((item, index) => (
                <tr key={`admin-staff-${item.name}-${index}`}>
                  <td>
                    <div className="staff-table-avatar">
                      {item.profileImage ? (
                        <img alt={item.name} className="staff-table-avatar__image" src={item.profileImage} />
                      ) : (
                        <span>{String(item.name || 'S').slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                    <span className="table-subcopy">{item.username} | {item.email}</span>
                  </td>
                  <td>{item.phone || '-'}</td>
                  <td>{item.role}</td>
                  <td>{item.branch}</td>
                  <td>{item.status}</td>
                  <td>{item.lastLoginLabel}</td>
                  <td>
                    <button className="clinical-workspace-button secondary-action--compact" onClick={() => openEditModal(item)} type="button">
                      Manage user
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">No staff records match the current search and filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <span className="table-counter">
            Showing {paginatedItems.length ? (currentPage - 1) * rowsPerPage + 1 : 0}
            {' - '}
            {Math.min(currentPage * rowsPerPage, filteredItems.length)} of {filteredItems.length}
          </span>
          <div className="reception-action-row">
            <button className="ghost-button secondary-action--compact" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
              Previous
            </button>
            <button className="ghost-button secondary-action--compact" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">
              Next
            </button>
          </div>
        </div>
      </section>

      <StaffManagementModal
        branches={branches}
        currentUserId={currentUserId}
        deleting={deleting}
        feedback={feedback}
        form={form}
        isOpen={modalOpen}
        onChange={handleChange}
        onClose={() => {
          setModalOpen(false);
          setForm(null);
          setFeedback('');
          setResetPassword('');
        }}
        onDelete={handleDelete}
        onResetPassword={handleResetPassword}
        onSave={handleSave}
        resetPassword={resetPassword}
        saving={saving}
        setResetPassword={setResetPassword}
        showNewPassword={showNewPassword}
        showPassword={showPassword}
        toggleNewPassword={() => setShowNewPassword((current) => !current)}
        togglePassword={() => setShowPassword((current) => !current)}
      />
    </>
  );
}
