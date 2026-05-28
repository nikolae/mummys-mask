import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { useState } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

// Returns true if the to_close text means the player can simply tap Close with no extra condition
function isAutoClose(to_close) {
  return /automatically/i.test(to_close || '');
}

export function LocationCard({ location, characters, currentCharId, sessionId, onUpdate, onExplore, exploredThisTurn }) {
  const { toast } = useApp();
  const { id, name, cards_remaining, is_open, is_permanently_closed, characters_here,
          at_location, to_close, when_closed, has_villain } = location;

  const [showInfo,       setShowInfo]       = useState(false);
  const [showClose,      setShowClose]      = useState(false);
  const [closeBusy,      setCloseBusy]      = useState(false);
  const [showTempClose,  setShowTempClose]  = useState(false);
  const [tempCloseBusy,  setTempCloseBusy]  = useState(false);

  const closed  = !!is_permanently_closed;
  const open    = !!is_open;
  const isTemp  = !open && !closed;
  const statusClass = closed ? 'closed' : isTemp ? 'temp-closed' : '';
  const badgeClass  = closed ? 'closed' : isTemp ? 'temp' : 'open';
  const badgeText   = closed ? 'Closed' : isTemp ? 'Temp Closed' : 'Open';

  const hasRules  = at_location || to_close || when_closed;
  const autoClose = isAutoClose(to_close);

  // Show the close button when: deck is empty OR this location can be closed at any time
  const canShowClose = !closed && open && (cards_remaining === 0 || autoClose);

  async function confirmClose() {
    setCloseBusy(true);
    try {
      await api.actionCloseLocation(sessionId, { location_id: id, success: true });
      // Surface the when_closed reward so the player knows to act on it
      if (when_closed && when_closed !== 'No effect.') {
        toast(`${name} closed — ${when_closed}`, 'warning');
      } else {
        toast(`${name} permanently closed.`);
      }
      setShowClose(false);
      onUpdate();
    } catch (e) {
      toast('Close failed: ' + e.message, 'error');
    } finally {
      setCloseBusy(false);
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

  async function confirmTempClose() {
    setTempCloseBusy(true);
    try {
      await api.actionTempClose(sessionId, { location_id: id });
      toast(`${name} temporarily closed — villain can't escape here this turn.`, 'warning');
      setShowTempClose(false);
      onUpdate();
    } catch (e) {
      toast('Temp close failed: ' + e.message, 'error');
    } finally {
      setTempCloseBusy(false);
    }
  }

  const currentCharHere = characters_here?.includes(currentCharId);

  return html`
    <div class=${'location-card ' + statusClass}>
      <div class="location-card-header">
        <span class="location-name">${name}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          ${has_villain && html`
            <span class="villain-here-badge" title="Villain is hiding here">⚡</span>
          `}
          ${hasRules && html`
            <button class="loc-info-btn" title="Location rules"
              onClick=${(e) => { e.stopPropagation(); setShowInfo(v => !v); }}>
              ${showInfo ? '▲' : 'ℹ'}
            </button>
          `}
          <span class=${'location-status-badge ' + badgeClass}>${badgeText}</span>
        </div>
      </div>

      ${showInfo && hasRules && html`
        <div class="location-rules-panel">
          ${at_location && html`
            <div class="loc-rule-row">
              <span class="loc-rule-label">Here</span>
              <span class="loc-rule-text">${at_location}</span>
            </div>
          `}
          ${to_close && html`
            <div class="loc-rule-row">
              <span class="loc-rule-label">To close</span>
              <span class="loc-rule-text">${to_close}</span>
            </div>
          `}
          ${when_closed && when_closed !== 'No effect.' && html`
            <div class="loc-rule-row">
              <span class="loc-rule-label">On close</span>
              <span class="loc-rule-text">${when_closed}</span>
            </div>
          `}
        </div>
      `}

      <div class="location-card-body">
        <div class="location-deck-count">
          <span class="deck-num">${cards_remaining}</span>
          <span class="deck-label">${' '}card${cards_remaining !== 1 ? 's' : ''}</span>
        </div>
        <div class="location-tokens">
          ${(characters_here || []).map(cid => {
            const ch = characters?.find(c => c.id === cid);
            if (!ch) return null;
            const hand   = ch.cards_in_hand ?? ch.hand_size ?? 0;
            const lowHand = hand <= 2;
            return html`
              <span key=${cid} class=${'char-token' + (cid === currentCharId ? ' current' : '') + (lowHand ? ' low-hand' : '')}>
                ${ch.name}${lowHand ? html`<span class="char-token-warn" title="${hand === 0 ? 'Out of cards!' : `Only ${hand} card${hand !== 1 ? 's' : ''} left`}">⚠</span>` : null}
              </span>
            `;
          })}
        </div>
      </div>

      ${!closed && !showClose && !showTempClose && html`
        <div class="location-card-footer" style="display:flex; gap:8px; flex-wrap:wrap;">
          ${!currentCharHere && currentCharId && html`
            <button class="btn-secondary btn-sm" onClick=${moveHere}>Move Here</button>
          `}
          ${currentCharHere && open && html`
            <button class=${'btn-primary btn-sm' + (exploredThisTurn ? ' btn-explored' : '')}
              onClick=${() => !exploredThisTurn && onExplore && onExplore(location)}
              disabled=${cards_remaining === 0 || exploredThisTurn}
              title=${exploredThisTurn ? 'Already explored this turn' : ''}>
              ${exploredThisTurn ? '✓ Explored' : 'Explore'}
            </button>
          `}
          ${canShowClose && currentCharHere && html`
            <button class="btn-ghost btn-sm" onClick=${() => setShowClose(true)}>
              ${autoClose && cards_remaining > 0 ? 'Close (auto)' : 'Close'}
            </button>
          `}
          ${!closed && open && currentCharHere && to_close && !canShowClose && html`
            <button class="btn-ghost btn-sm temp-close-btn"
              onClick=${() => setShowTempClose(true)}
              title="Temporarily close to block villain escape">
              Temp Close
            </button>
          `}
        </div>
      `}

      ${/* Close confirmation panel */ showClose && html`
        <div class="location-close-confirm">
          <div class="close-confirm-title">Close ${name}?</div>

          <div class="close-confirm-row">
            <span class="close-confirm-label">Condition</span>
            <span class="close-confirm-text">${to_close || 'No special condition.'}</span>
          </div>

          ${when_closed && when_closed !== 'No effect.' && html`
            <div class="close-confirm-row close-confirm-reward">
              <span class="close-confirm-label">Reward</span>
              <span class="close-confirm-text">${when_closed}</span>
            </div>
          `}

          <div class="close-confirm-actions">
            <button class="btn-secondary btn-sm" onClick=${() => setShowClose(false)}>Cancel</button>
            <button class="btn-primary btn-sm" onClick=${confirmClose} disabled=${closeBusy}>
              ${closeBusy ? 'Closing…' : 'Confirm Close'}
            </button>
          </div>
        </div>
      `}

      ${/* Temp-close confirmation panel */ showTempClose && html`
        <div class="location-close-confirm">
          <div class="close-confirm-title">Temp Close ${name}?</div>
          <div class="close-confirm-row">
            <span class="close-confirm-label">Condition</span>
            <span class="close-confirm-text">${to_close}</span>
          </div>
          <p class="close-confirm-temp-note">
            This location will reopen at the end of this player's turn.
            Use this to block the villain from escaping here.
          </p>
          <div class="close-confirm-actions">
            <button class="btn-secondary btn-sm" onClick=${() => setShowTempClose(false)}>Cancel</button>
            <button class="btn-primary btn-sm" onClick=${confirmTempClose} disabled=${tempCloseBusy}>
              ${tempCloseBusy ? 'Closing…' : 'Confirm Temp Close'}
            </button>
          </div>
        </div>
      `}

      ${closed && html`
        <div class="location-closed-overlay">Sealed</div>
      `}
    </div>
  `;
}
