import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';

const CYCLE = ['dark', 'light', 'high-contrast'];
const ICONS = { dark: '🌑', light: '☀️', 'high-contrast': '⬛' };
const LABELS = { dark: 'Dark', light: 'Parchment', 'high-contrast': 'High Contrast' };

export function ThemeToggle({ small = false }) {
  const { state, setTheme } = useApp();
  const current = state.theme || 'dark';

  function cycle() {
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  }

  return html`
    <button
      class=${'btn-ghost theme-toggle' + (small ? ' theme-toggle--sm' : '')}
      onClick=${cycle}
      title=${'Theme: ' + LABELS[current] + ' — tap to cycle'}
    >
      <span class="theme-toggle-icon">${ICONS[current]}</span>
      ${!small && html`<span class="theme-toggle-label">${LABELS[current]}</span>`}
    </button>
  `;
}
