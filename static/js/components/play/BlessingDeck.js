import { html } from '/static/js/html.js';

export function BlessingDeck({ remaining, total = 30 }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const cls = pct > 50 ? 'safe' : pct > 25 ? 'warn' : 'danger';

  return html`
    <div class="blessing-deck">
      <div class="blessing-count">
        <span class="num">${remaining}</span>
        <span class="denom"> / ${total}</span>
      </div>
      <div class="blessing-bar-track">
        <div class="blessing-bar-fill ${cls}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}
