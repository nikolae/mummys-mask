import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import * as api from '/static/js/api.js';

export function CharacterBar({ session, currentCharId, onSelectChar, onOpenSheet, onUpdate }) {
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

  async function adjustHand(charId, delta, currentCount) {
    const newCount = Math.max(0, currentCount + delta);
    try {
      await api.actionSetHand(sessionId, { character_id: charId, count: newCount });
      onUpdate();
    } catch (e) {
      toast('Failed to update hand', 'error');
    }
  }

  return html`
    <div class="character-bar">
      ${characters.map(c => {
        const handCount = c.cards_in_hand ?? c.hand_size;
        const handLow   = handCount <= 2;
        const handEmpty = handCount === 0;

        return html`
          <div key=${c.id}
            class=${'character-chip' + (c.id === currentCharId ? ' active' : '') + (c.is_dead ? ' dead' : '')}
            onClick=${() => onSelectChar(c.id)}>
            <div class="char-type">${c.character_type}</div>
            <div class="char-name">${c.name}</div>

            <!-- Hand count tracker -->
            <div class="char-hand-track" onClick=${e => e.stopPropagation()}>
              <button class="hand-adj-btn" title="Discard / take damage"
                onClick=${() => adjustHand(c.id, -1, handCount)}
                disabled=${handCount <= 0}>−</button>
              <span class=${'hand-count' + (handEmpty ? ' hand-empty' : handLow ? ' hand-low' : '')}
                title="Cards in hand / max hand size">
                ${handCount}/${c.hand_size}
              </span>
              <button class="hand-adj-btn" title="Draw / heal a card"
                onClick=${() => adjustHand(c.id, +1, handCount)}
                disabled=${handCount >= c.hand_size}>+</button>
            </div>

            ${c.role ? html`<span class="char-role-badge">${c.role.split(' ')[0]}</span>` : null}
            <button class="char-info-btn" title="Character sheet"
              onClick=${e => { e.stopPropagation(); onOpenSheet && onOpenSheet(c); }}>
              ℹ
            </button>
          </div>
        `;
      })}
      <div class="character-bar-actions">
        <div class="phase-indicator">
          <div class="phase-dot"></div>
          ${current_phase?.toUpperCase() ?? 'EXPLORE'}
        </div>
        <span class="turn-num">Turn <span>${turn_number}</span></span>
        ${current_player === currentCharId && (() => {
          const activeChar = characters?.find(c => c.id === current_player);
          const handCount  = activeChar?.cards_in_hand ?? activeChar?.hand_size ?? 0;
          const toDraw     = (activeChar?.hand_size ?? 0) - handCount;
          return html`
            <div class="end-turn-wrap">
              ${toDraw > 0 && html`
                <div class="draw-hint">
                  Draw ${toDraw} card${toDraw !== 1 ? 's' : ''} to refill hand
                </div>
              `}
              <button class="btn-primary btn-sm" onClick=${endTurn}>End Turn</button>
            </div>
          `;
        })()}
      </div>
    </div>
  `;
}
