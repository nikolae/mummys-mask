import { html } from '/static/js/html.js';
import { useState } from '/static/js/vendor/hooks.module.js';
import { useApp } from '/static/js/state.js';
import * as api from '/static/js/api.js';

export function CharacterBar({ session, currentCharId, onSelectChar, onOpenSheet, onUpdate }) {
  const { toast } = useApp();
  const { characters, current_player, current_phase, turn_number, explored_this_turn,
          id: sessionId } = session;
  const [confirmEndTurn, setConfirmEndTurn] = useState(false);

  async function endTurn() {
    setConfirmEndTurn(false);
    try {
      await api.actionEndTurn(sessionId);
      onUpdate();
    } catch (e) {
      toast('End turn failed: ' + e.message, 'error');
    }
  }

  function handleEndTurnClick() {
    if (!explored_this_turn && !confirmEndTurn) {
      setConfirmEndTurn(true);
      return;
    }
    endTurn();
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

  async function adjustDeck(charId, delta, currentCount) {
    const newCount = Math.max(0, currentCount + delta);
    try {
      await api.actionSetDeckCount(sessionId, { character_id: charId, count: newCount });
      onUpdate();
    } catch (e) {
      toast('Failed to update deck count', 'error');
    }
  }

  return html`
    <div class="character-bar">
      ${characters.map(c => {
        const handCount = c.cards_in_hand ?? c.hand_size;
        const handLow   = handCount <= 2;
        const handEmpty = handCount === 0;
        const deckCount = c.cards_in_deck ?? 15;
        const deckLow   = deckCount <= 5;
        const deckCrit  = deckCount <= 2;

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

            <!-- Deck depth tracker -->
            <div class="char-deck-track" onClick=${e => e.stopPropagation()}
              title="Cards remaining in personal deck — tap − when a card is permanently banished">
              <span class="char-deck-icon">🂠</span>
              <span class=${'deck-count' + (deckCrit ? ' deck-crit' : deckLow ? ' deck-low' : '')}>
                ${deckCount}
                ${deckCrit ? html`<span class="deck-warn-badge">!</span>` : deckLow ? html`<span class="deck-warn-badge">⚠</span>` : null}
              </span>
              <button class="hand-adj-btn deck-adj-btn" title="Card permanently banished/buried"
                onClick=${() => adjustDeck(c.id, -1, deckCount)}
                disabled=${deckCount <= 0}>−</button>
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
        <!-- Phase stepper -->
        <div class="phase-stepper">
          <div class=${'phase-step' + (explored_this_turn ? ' phase-step--done' : ' phase-step--active')}>
            ${explored_this_turn ? '✓' : '🎴'} Explore
          </div>
          <span class="phase-step-arrow">›</span>
          <div class=${'phase-step' + (explored_this_turn ? ' phase-step--active' : '')}>
            🏁 End Turn
          </div>
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
              ${confirmEndTurn && !explored_this_turn && html`
                <div class="end-turn-confirm">
                  <span class="end-turn-confirm-text">Haven't explored yet — end turn?</span>
                  <button class="btn-secondary btn-xs"
                    onClick=${() => setConfirmEndTurn(false)}>Cancel</button>
                  <button class="btn-warning btn-xs"
                    onClick=${endTurn}>End anyway</button>
                </div>
              `}
              <button class="btn-primary btn-sm" onClick=${handleEndTurnClick}>End Turn</button>
            </div>
          `;
        })()}
      </div>
    </div>
  `;
}
