import React from 'react';
import { DashboardStatIcon } from './DashboardStatIcon';

export function StatGrid({ items }) {
  return (
    <section className="stats-grid content-grid">
      {items.map((item) => (
        <article className="stat-card" key={item.label}>
          <div className="stat-card-icon">
            <DashboardStatIcon item={item} />
          </div>
          <span className="stat-card__label">{item.label}</span>
          <h3>{item.value}</h3>
          <p className="stat-card__trend">{item.trend}</p>
        </article>
      ))}
    </section>
  );
}
