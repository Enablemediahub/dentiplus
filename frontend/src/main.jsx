import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const rootElement = document.getElementById('root');
let fallbackShown = false;

function renderBootstrapError(error) {
  if (!document.body || fallbackShown) {
    return;
  }

  fallbackShown = true;

  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  const wrapper = document.createElement('main');
  wrapper.setAttribute('data-bootstrap-overlay', 'true');
  wrapper.style.position = 'fixed';
  wrapper.style.inset = '0';
  wrapper.style.zIndex = '9999';
  wrapper.style.minHeight = '100vh';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.padding = '24px';
  wrapper.style.background = '#09111c';
  wrapper.style.color = '#e8eef7';
  wrapper.style.fontFamily = 'Outfit, sans-serif';

  const card = document.createElement('section');
  card.style.maxWidth = '760px';
  card.style.width = '100%';
  card.style.padding = '24px';
  card.style.borderRadius = '24px';
  card.style.border = '1px solid rgba(255,255,255,0.08)';
  card.style.background = 'linear-gradient(180deg,rgba(18,35,56,0.96),rgba(13,25,40,0.9))';
  card.style.boxShadow = '0 32px 60px rgba(4,12,22,0.42)';

  const eyebrow = document.createElement('p');
  eyebrow.textContent = 'Frontend bootstrap error';
  eyebrow.style.margin = '0 0 8px';
  eyebrow.style.color = '#78e4cf';
  eyebrow.style.fontSize = '12px';
  eyebrow.style.fontWeight = '700';
  eyebrow.style.letterSpacing = '0.14em';
  eyebrow.style.textTransform = 'uppercase';

  const title = document.createElement('h1');
  title.textContent = 'Dentiplus could not finish loading.';
  title.style.margin = '0 0 12px';
  title.style.fontSize = '28px';

  const details = document.createElement('pre');
  details.textContent = message;
  details.style.whiteSpace = 'pre-wrap';
  details.style.wordBreak = 'break-word';
  details.style.margin = '0';
  details.style.color = '#ffd3ca';

  card.append(eyebrow, title, details);
  wrapper.appendChild(card);
  document.body.appendChild(wrapper);
}

window.addEventListener('error', (event) => {
  if (event.error) {
    renderBootstrapError(event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  renderBootstrapError(event.reason ?? 'Unhandled promise rejection');
});

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
  renderBootstrapError(error);
}
