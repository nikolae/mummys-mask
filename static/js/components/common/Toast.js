import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';

export function ToastContainer() {
  const { state } = useApp();
  if (!state.toasts.length) return null;
  return html`
    <div class="toast-container">
      ${state.toasts.map(t => html`
        <div key=${t.id} class=${'toast' + (t.type === 'error' ? ' error' : '')}>
          ${t.message}
        </div>
      `)}
    </div>
  `;
}
