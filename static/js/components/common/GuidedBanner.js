import { html } from '/static/js/html.js';
import { useState } from '/static/js/vendor/hooks.module.js';
import { useApp } from '/static/js/state.js';

/**
 * GuidedBanner — a contextual step callout shown when guided mode is on.
 *
 * Props:
 *   icon   — emoji for the step (default 🎓)
 *   title  — short heading, e.g. "Add Your Characters"
 *   body   — instruction text (string or array of strings for paragraphs)
 *   tip    — optional 💡 tip line
 */
export function GuidedBanner({ icon = '🎓', title, body, tip }) {
  const { toggleGuided } = useApp();
  const paragraphs = Array.isArray(body) ? body : [body];

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('guided-banner-collapsed') === '1'; } catch { return false; }
  });

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('guided-banner-collapsed', next ? '1' : '0'); } catch {}
  }

  return html`
    <div class=${'guided-banner' + (collapsed ? ' guided-banner--collapsed' : '')}>
      <div class="guided-banner-head">
        <span class="guided-banner-icon">${icon}</span>
        <span class="guided-banner-title">${title}</span>
        <button class="guided-collapse-btn" onClick=${toggleCollapse}
          title=${collapsed ? 'Expand guidance' : 'Minimise guidance'}>
          ${collapsed ? '▼' : '▲'}
        </button>
      </div>
      ${!collapsed && paragraphs.map((p, i) => html`<p key=${i} class="guided-banner-body">${p}</p>`)}
      ${!collapsed && tip && html`
        <p class="guided-banner-tip"><span class="guided-tip-icon">💡</span>${' '}${tip}</p>
      `}
      ${!collapsed && html`
        <button class="btn-link guided-off-link" onClick=${toggleGuided}>
          Turn off guided mode
        </button>
      `}
    </div>
  `;
}
