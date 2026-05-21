import React from 'react';
import { PortalIcon } from './PortalIcon';

const LABEL_ICON_MAP = {
  'today appointments': 'calendar',
  'waiting queue': 'clock',
  'expenses today': 'finance',
  'sales today': 'receipt',
  'today schedule': 'calendar',
  'chair queue': 'clock',
  'open billing items': 'receipt',
  'insurance support': 'shield',
  'collections today': 'receipt',
  'open bills': 'briefcase',
  'insurance claims': 'shield',
  'active staff': 'briefcase',
  'today patients': 'patients',
  'collections snapshot': 'trend',
  'alerts & tasks': 'check-badge',
  'new patients': 'patients',
  'expenses': 'finance',
  'sales': 'trend',
  'new registrations': 'patients',
  'billing handoffs': 'receipt',
  'active queue': 'clock',
  'follow-ups due': 'support',
  'draft notes': 'layers',
  'expenses logged': 'finance',
  'outstanding balances': 'reports',
};

function resolveIconName(item) {
  if (item?.icon) {
    return item.icon;
  }

  return LABEL_ICON_MAP[String(item?.label ?? '').trim().toLowerCase()] ?? 'dashboard';
}

export function DashboardStatIcon({ item }) {
  return <PortalIcon className="nav-icon stat-card-icon-svg" name={resolveIconName(item)} />;
}
