import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import * as api from '/static/js/api.js';

export function CharacterBar({ session, currentCharId, onSelectChar, onUpdate }) {
  const { toast } = useApp();
  const { characters, current_player, current_phase, turn_number, id: sessionId } = session;

  async function endTurn() {
    try {
      await api.actionEndTurn(sessionId);
      onUpdate();
    } catch (e) {
      toast('End turn failed: ' + e.message, 'error');
    }
  }

  return html`
    <div class="character-bar">
      ${characters.map(c => html`
        <div key=${c.id}
          class=${'character-chip' + (c.id === currentCharId ? ' active' : '')}
          onClick=${() => onSelectChar(c.id)}>
          <div class="char-type">${c.character_type}</div>
          <div class="char-name">${c.name}</div>
          <div class="char-hand">Hand: ${c.hand_size}</div>
        </div>
      `)}
      <div class="character-bar-actions">
        <div class="phase-indicator">
          <div class="phase-dot"></div>
          ${current_phase?.toUpperCase() ?? 'EXPLORE'}
        </div>
        <span class="turn-num">Turn <span>${turn_number}</span></span>
        ${current_player === currentCharId && html`
          <button class="btn-primary btn-sm" onClick=${endTurn}>End Turn</button>
        `}
      </div>
    </div>
  `;
}
