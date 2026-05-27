import { html } from '/static/js/html.js';
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

  return html`
    <div class="guided-banner">
      <div class="guided-banner-head">
        <span class="guided-banner-icon">${icon}</span>
        <span class="guided-banner-title">${title}</span>
      </div>
      ${paragraphs.map((p, i) => html`<p key=${i} class="guided-banner-body">${p}</p>`)}
      ${tip && html`
        <p class="guided-banner-tip"><span class="guided-tip-icon">💡</span>${' '}${tip}</p>
      `}
      <button class="btn-link guided-off-link" onClick=${toggleGuided}>
        Turn off guided mode
      </button>
    </div>
  `;
}
