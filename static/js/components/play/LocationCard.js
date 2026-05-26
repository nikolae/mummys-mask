import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import * as api from '/static/js/api.js';

export function LocationCard({ location, characters, currentCharId, sessionId, onUpdate }) {
  const { toast } = useApp();
  const { id, name, cards_remaining, is_open, is_permanently_closed, characters_here } = location;

  const closed = !!is_permanently_closed;
  const open = !!is_open;
  const isTemp = !open && !closed;
  const statusClass = closed ? 'closed' : isTemp ? 'temp-closed' : '';
  const badgeClass = closed ? 'closed' : isTemp ? 'temp' : 'open';
  const badgeText = closed ? 'Closed' : isTemp ? 'Temp Closed' : 'Open';

  async function explore() {
    try {
      await api.actionExplore(sessionId, { location_id: id });
      onUpdate();
    } catch (e) {
      toast('Explore failed: ' + e.message, 'error');
    }
  }

  async function closeLocation() {
    try {
      await api.actionCloseLocation(sessionId, { location_id: id, success: true });
      onUpdate();
    } catch (e) {
      toast('Close failed: ' + e.message, 'error');
    }
  }

  async function moveHere() {
    if (!currentCharId) return;
    try {
      await api.actionMove(sessionId, { character_id: currentCharId, location_id: id });
      onUpdate();
    } catch (e) {
      toast('Move failed: ' + e.message, 'error');
    }
  }

  const currentCharHere = characters_here?.includes(currentCharId);

  return html`
    <div class=${'location-card ' + statusClass}>
      <div class="location-card-header">
        <span class="location-name">${name}</span>
        <span class=${'location-status-badge ' + badgeClass}>${badgeText}</span>
      </div>
      <div class="location-card-body">
        <div class="location-deck-count">
          <span class="deck-num">${cards_remaining}</span>
          <span class="deck-label">${' '}card${cards_remaining !== 1 ? 's' : ''}</span>
        </div>
        <div class="location-tokens">
          ${(characters_here || []).map(cid => {
            const ch = characters?.find(c => c.id === cid);
            if (!ch) return null;
            return html`
              <span key=${cid} class=${'char-token' + (cid === currentCharId ? ' current' : '')}>
                ${ch.name}
              </span>
            `;
          })}
        </div>
      </div>
      ${!closed && html`
        <div class="location-card-footer" style="display:flex; gap:8px; flex-wrap:wrap;">
          ${!currentCharHere && currentCharId && html`
            <button class="btn-secondary btn-sm" onClick=${moveHere}>Move Here</button>
          `}
          ${currentCharHere && open && html`
            <button class="btn-primary btn-sm" onClick=${explore}
              disabled=${cards_remaining === 0}>
              Explore
            </button>
          `}
          ${currentCharHere && open && cards_remaining === 0 && html`
            <button class="btn-ghost btn-sm" onClick=${closeLocation}>Close</button>
          `}
        </div>
      `}
      ${closed && html`
        <div class="location-closed-overlay">Sealed</div>
      `}
    </div>
  `;
}
