import { html } from '/static/js/html.js';
import { useEffect } from '/static/js/vendor/hooks.module.js';

export function Modal({ title, onClose, footer, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return html`
    <div class="modal-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close btn-icon" onClick=${onClose} aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${children}</div>
        ${footer && html`<div class="modal-footer">${footer}</div>`}
      </div>
    </div>
  `;
}
