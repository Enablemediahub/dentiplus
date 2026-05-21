import React from 'react';

export function FooterBar({ clinicName }) {
  return (
    <footer className="portal-footer screen-footer app-credit-footer">
      <span>{clinicName || 'eDENTAL CLINICS'}</span>
      <span>Developed and Designed by DALE QUIST [Enable Technologies]</span>
    </footer>
  );
}
