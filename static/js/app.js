import { h, render } from '/static/js/vendor/preact.module.js';
import { useEffect } from '/static/js/vendor/hooks.module.js';
import { AppContext, useAppState } from '/static/js/state.js';
import { html } from '/static/js/html.js';
import { CampaignHome } from '/static/js/components/campaign/CampaignHome.js';
import { SetupView } from '/static/js/components/setup/SetupView.js';
import { PlayBoard } from '/static/js/components/play/PlayBoard.js';
import { ToastContainer } from '/static/js/components/common/Toast.js';
import * as api from '/static/js/api.js';

function App() {
  const appState = useAppState();
  const { state, patch } = appState;

  // Apply persisted theme on startup
  useEffect(() => {
    const saved = localStorage.getItem('mm_theme') || 'dark';
    if (saved === 'dark') {
      document.body.removeAttribute('data-theme');
    } else {
      document.body.setAttribute('data-theme', saved);
    }
  }, []);

  // Load settings from server on startup
  useEffect(() => {
    api.getSettings().then(settings => {
      if (settings?.owned_products) {
        patch({ ownedProducts: settings.owned_products });
      }
    }).catch(() => { /* non-fatal; use defaults */ });
  }, []);

  let view;
  switch (state.view) {
    case 'setup': view = html`<${SetupView} />`; break;
    case 'play':  view = html`<${PlayBoard} />`; break;
    default:      view = html`<${CampaignHome} />`; break;
  }

  return html`
    <${AppContext.Provider} value=${appState}>
      ${view}
      <${ToastContainer} />
    </${AppContext.Provider}>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
