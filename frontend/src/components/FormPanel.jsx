import React from 'react';

export function FormPanel({ title, description, fields, actionLabel }) {
  return (
    <section className="panel workspace-card">
      <div className="panel-heading workspace-card__header">
        <div>
          <p className="eyebrow">Action panel</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="form-grid">
        {fields.map((field) => (
          <label className="field-block" key={field.label}>
            <span>{field.label}</span>
            {field.type === 'textarea' ? (
              <textarea placeholder={field.placeholder} rows={4} />
            ) : (
              <input placeholder={field.placeholder} type={field.type ?? 'text'} />
            )}
          </label>
        ))}
      </div>

      <div className="workspace-card__actions">
        <button className="primary-button" type="button">
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
