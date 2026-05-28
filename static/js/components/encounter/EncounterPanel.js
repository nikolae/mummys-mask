import { html } from '/static/js/html.js';
import { useState, useEffect, useRef, useCallback } from '/static/js/vendor/hooks.module.js';
import { useApp } from '/static/js/state.js';
import { DiceRoller } from '/static/js/components/encounter/DiceRoller.js';
import { ContextualRules } from '/static/js/components/common/RulesChip.js';
import * as api from '/static/js/api.js';

// ── Card Search with autocomplete ────────────────────────────────────────────

function CardSearch({ onSelect, initialQuery, ownedProducts }) {
  const [query, setQuery]       = useState(initialQuery || '');
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const debounce                = useRef(null);

  // If an initialQuery is provided (e.g. card type from hybrid reveal), run it immediately
  useEffect(() => {
    if (initialQuery && initialQuery.length >= 2) {
      api.searchCards(initialQuery, ownedProducts).then(r => {
        setResults(r);
        setOpen(r.length > 0);
      });
    }
  }, []);

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounce.current);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      const r = await api.searchCards(val, ownedProducts);
      setResults(r);
      setOpen(r.length > 0);
    }, 200);
  }

  function pick(card) {
    setQuery(card.name);
    setOpen(false);
    onSelect(card);
  }

  return html`
    <div class="card-search-wrap">
      <input type="text" placeholder="Card drawn (e.g. Sand Thief, Warrior Dolls…)"
        value=${query}
        onInput=${handleInput}
        onFocus=${() => results.length && setOpen(true)}
        onBlur=${() => setTimeout(() => setOpen(false), 150)}
      />
      ${open && html`
        <div class="card-search-results">
          ${results.map(c => html`
            <div key=${c.name} class="card-search-item" onMouseDown=${() => pick(c)}>
              <span class=${'card-search-type ' + (c.type || '')}>${c.type}</span>
              ${c.name}
              ${c.traits?.length
                ? html`<span style="color:var(--text-dim); font-size:11px; margin-left:auto;">
                    ${c.traits.slice(0, 3).join(', ')}
                  </span>`
                : null}
            </div>
          `)}
        </div>
      `}
    </div>
  `;
}

// ── Card info display ────────────────────────────────────────────────────────

function CardInfo({ card }) {
  if (!card) return null;
  const checks = card.checks || [];
  const isVillain  = card.type === 'villain';
  const isHenchman = card.type === 'henchman';

  return html`
    <div class=${'card-info' + (isVillain ? ' card-info--villain' : '')}>
      ${isVillain && html`
        <div class="villain-banner">⚡ VILLAIN — Close all other locations first!</div>
      `}
      ${isHenchman && html`
        <div class="henchman-banner">⚔ Henchman — Defeat to attempt closing this location</div>
      `}
      <div class="card-info-name">${card.name}</div>
      <div class="card-info-meta">
        <span class=${'card-search-type ' + (card.type || '')}>${card.type}</span>
        ${card.subtype && html`<span class="card-trait">${card.subtype}</span>`}
        ${(card.traits || []).map(t => html`<span key=${t} class="card-trait">${t}</span>`)}
      </div>
      ${checks.map((c, i) => html`
        <div key=${i} class="card-check">
          Check to defeat:${' '}
          <strong>${c.skills?.join(' or ') ?? '?'} ${c.difficulty}</strong>
        </div>
      `)}
      ${card.powers && html`
        <div style="font-size:12px; color:var(--text-dim); margin-top:4px; line-height:1.5;">
          ${card.powers.split('\n').filter(Boolean).map((line, i) => html`
            <p key=${i} style="margin-bottom:4px;">${line}</p>
          `)}
        </div>
      `}
    </div>
  `;
}

// ── Lore display ─────────────────────────────────────────────────────────────

function LoreSection({ entries }) {
  if (!entries?.length) return null;
  // Only show during-encounter entries; never fall back to a different trigger type
  const entry = entries.find(e => e.trigger === 'when_encountering');
  if (!entry) return null;
  return html`
    <div class="lore-panel">
      <div class="lore-label">⚱ Adventure Journal</div>
      <div class="lore-text">${entry.text}</div>
    </div>
  `;
}

// ── Post-encounter lore interstitial ─────────────────────────────────────────

const BOON_TYPES = new Set(['weapon', 'spell', 'armor', 'item', 'ally', 'blessing']);

function PostEncounterLore({ card, loreEntries, onContinue }) {
  const isAcquire = BOON_TYPES.has(card?.type);
  const trigger   = isAcquire ? 'after_acquiring' : 'after_defeating';
  const entry     = loreEntries?.find(e => e.trigger === trigger);
  // If somehow no entry (shouldn't happen since caller checks first), just show continue
  if (!entry) return html`
    <div class="post-encounter-lore">
      <button class="btn-primary btn-sm post-lore-continue" onClick=${onContinue}>Continue</button>
    </div>
  `;

  return html`
    <div class="post-encounter-lore">
      <div class="post-encounter-lore-header">
        ${isAcquire
          ? html`<span class="post-lore-acquire-badge">✦ Acquired: ${card.name}</span>`
          : html`<span class="post-lore-defeat-badge">⚔ ${card.name} defeated</span>`
        }
      </div>
      <div class="lore-label" style="margin-top:8px;">⚱ Adventure Journal</div>
      <div class="lore-text">${entry.text}</div>
      <button class="btn-primary btn-sm post-lore-continue" onClick=${onContinue}>
        Continue
      </button>
    </div>
  `;
}

// ── Damage recorder ───────────────────────────────────────────────────────────

const BANE_TYPES = new Set(['monster', 'barrier', 'henchman', 'villain']);
const DAMAGE_LABEL = { monster: 'combat', barrier: 'combat', henchman: 'combat', villain: 'combat' };

function DamageRecorder({ card, sessionId, characters, currentCharId, guidedMode, onUpdate }) {
  const { toast } = useApp();
  const [amount, setAmount] = useState(0);
  const [charId, setCharId] = useState(currentCharId);
  const [applied, setApplied] = useState(false);

  // Try to extract the damage number from powers text (e.g. "dealt 2 Combat damage")
  const suggestedAmount = (() => {
    const m = card.powers?.match(/dealt?\s+(\d+)\s+\w+\s+damage/i);
    return m ? parseInt(m[1]) : 0;
  })();

  useEffect(() => {
    if (suggestedAmount > 0) setAmount(suggestedAmount);
  }, [card.name]);

  const isTrigger = card.traits?.some(t => t.toLowerCase() === 'trigger');
  const currentChar = characters?.find(c => c.id === charId);
  const handCount = currentChar?.cards_in_hand ?? currentChar?.hand_size ?? 0;

  async function applyDamage() {
    if (!amount || !charId) return;
    try {
      await api.actionDamage(sessionId, { character_id: charId, amount });
      setApplied(true);
      onUpdate();
      toast(`${currentChar?.name ?? 'Character'} discards ${amount} card${amount !== 1 ? 's' : ''}`);
    } catch (e) {
      toast('Failed to record damage', 'error');
    }
  }

  if (!BANE_TYPES.has(card.type)) return null;

  return html`
    <div class="damage-recorder">
      ${isTrigger && html`
        <div class="trigger-banner">
          <span class="trigger-banner-label">⚡ Trigger</span>
          <span class="trigger-banner-text">
            This card deals its examine effect <strong>before</strong> you attempt the check.
            Record and discard those cards from your hand first.
          </span>
        </div>
      `}

      <div class="damage-recorder-body">
        <div class="damage-recorder-head">
          💔 Damage
          ${guidedMode && html`
            <span class="damage-guide-hint">
              — discard this many cards from your physical hand. If your hand is empty, remove from your deck instead.
            </span>
          `}
        </div>

        <!-- Character selector (if more than one) -->
        ${characters?.length > 1 && html`
          <div class="damage-char-row">
            <label style="font-size:12px; color:var(--text-dim);">Who takes damage?</label>
            <select value=${charId} onChange=${e => { setCharId(e.target.value); setApplied(false); }}>
              ${characters.map(c => html`
                <option key=${c.id} value=${c.id}>${c.name} (${c.cards_in_hand ?? c.hand_size} cards)</option>
              `)}
            </select>
          </div>
        `}

        <div class="damage-stepper-row">
          <button class="damage-step-btn" onClick=${() => { setAmount(a => Math.max(0, a - 1)); setApplied(false); }}>−</button>
          <span class="damage-amount">${amount}</span>
          <button class="damage-step-btn" onClick=${() => { setAmount(a => a + 1); setApplied(false); }}>+</button>
          <button class=${'btn-primary btn-sm damage-apply' + (applied ? ' damage-applied' : '')}
            onClick=${applyDamage}
            disabled=${amount === 0 || applied}>
            ${applied ? '✓ Applied' : `Apply to ${currentChar?.name ?? '…'}`}
          </button>
        </div>

        ${applied && handCount <= 2 && html`
          <p class="damage-warning">
            ${handCount === 0
              ? `⚠ ${currentChar?.name} is out of cards — remaining damage comes from their deck!`
              : `⚠ ${currentChar?.name} is low on cards (${handCount} left) — be careful!`
            }
          </p>
        `}
      </div>
    </div>
  `;
}

// ── Main EncounterPanel ───────────────────────────────────────────────────────

export function EncounterPanel({ location, sessionId, blessingsRemaining,
                                  characters, currentCharId,
                                  revealedCard,
                                  onClose, onUpdate, onVillainSpotted }) {
  const { state, toast } = useApp();
  const { guidedMode, ownedProducts } = state;
  const [selectedCard, setSelectedCard] = useState(null);
  const [lore, setLore]                 = useState(null);
  const [diceTotal, setDiceTotal]       = useState(null);
  const [busy, setBusy]                 = useState(false);
  // After defeating a henchman, ask whether to attempt closing the location
  const [showHenchmanClose, setShowHenchmanClose] = useState(false);
  const [henchmanCloseBusy, setHenchmanCloseBusy] = useState(false);
  // Post-defeat / post-acquire lore interstitial
  const [showPostLore, setShowPostLore] = useState(false);

  // Auto-populate card search when a revealed card comes in from hybrid explore
  useEffect(() => {
    if (!revealedCard) return;
    // Only auto-fill if we have an actual card name (villain or henchman)
    const name = revealedCard.name;
    if (!name) return;
    // Fetch the full card data so CardInfo gets everything it needs
    api.getCard(name).then(card => {
      setSelectedCard(card);
    }).catch(() => {
      // Fallback: construct a minimal card from the revealed data
      setSelectedCard({ name, type: revealedCard.type, checks: [], traits: [] });
    });
  }, [revealedCard?.name]);

  // Load lore whenever a card is selected
  useEffect(() => {
    if (!selectedCard) { setLore(null); return; }
    api.getLore(selectedCard.name).then(entries => {
      setLore(entries.length ? entries : null);
    }).catch(() => setLore(null));
    // Fire villain broadcast for physical mode (hybrid mode fires it before the panel opens)
    if (selectedCard.type === 'villain' && onVillainSpotted) {
      onVillainSpotted();
    }
  }, [selectedCard?.name]);

  async function resolve(result) {
    setBusy(true);
    try {
      const data = await api.actionEncounter(sessionId, {
        location_id: location.id,
        card_name: selectedCard?.name || '',
        result,
        dice_total: diceTotal,
      });
      if (data?._escaped_to) {
        toast(`The villain escaped to ${data._escaped_to}!`, 'warning');
      }
      onUpdate();
      if (result === 'defeated') {
        // Henchman: prompt to close location
        if (selectedCard?.type === 'henchman') {
          setBusy(false);
          setShowHenchmanClose(true);
          return;
        }
        // Any other card: show post-encounter lore if available
        const hasPostLore = lore?.some(e =>
          BOON_TYPES.has(selectedCard?.type) ? e.trigger === 'after_acquiring' : e.trigger === 'after_defeating'
        );
        if (hasPostLore) {
          setBusy(false);
          setShowPostLore(true);
          return;
        }
      }
      onClose();
    } catch (e) {
      console.error(e);
      toast('Encounter failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleHenchmanClose(doClose) {
    if (!doClose) { onClose(); return; }
    setHenchmanCloseBusy(true);
    try {
      await api.actionCloseLocation(sessionId, { location_id: location.id, success: true });
      const when = location.when_closed;
      if (when && when !== 'No effect.') {
        toast(`${location.name} closed — ${when}`, 'warning');
      } else {
        toast(`${location.name} permanently closed.`);
      }
      onUpdate();
      onClose();
    } catch (e) {
      toast('Close failed: ' + e.message, 'error');
    } finally {
      setHenchmanCloseBusy(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const isBane   = selectedCard && BANE_TYPES.has(selectedCard.type);
  const isBoon   = selectedCard && BOON_TYPES.has(selectedCard.type);

  // For hybrid mode: if a card was revealed, show a banner explaining what happened.
  // Named reveal (villain/henchman): card is auto-loaded into selectedCard.
  // Typed placeholder (name: null): pre-fill CardSearch with the type so results appear immediately.
  const hybridNamed = revealedCard?.name;
  const hybridTyped = !hybridNamed && revealedCard?.type;
  const cardSearchInitialQuery = hybridTyped ? revealedCard.type : '';

  const TYPE_ICON = { monster: '👹', barrier: '🚧', weapon: '⚔', spell: '✨',
                      armor: '🛡', item: '🎒', ally: '👥', blessing: '🙏' };

  return html`
    <div class="encounter-backdrop" onClick=${handleBackdrop}>
      <div class="encounter-panel">
        <div class="encounter-header">
          <span class="encounter-title">Encounter — ${location.name}</span>
          <button class="btn-ghost btn-sm" onClick=${onClose}
            style="min-height:32px; padding:0 12px;">
            Evade
          </button>
          <button class="modal-close btn-icon" onClick=${onClose}
            style="min-height:36px; min-width:36px; font-size:18px;">✕</button>
        </div>

        <div class="encounter-body">
          ${location.at_location && html`
            <div class="at-location-banner">
              <span class="at-location-icon">📍</span>
              <span class="at-location-text"><strong>${location.name}:</strong>${' '}${location.at_location}</span>
            </div>
          `}

          ${hybridNamed && html`
            <div class="hybrid-reveal-banner named">
              ${revealedCard.type === 'villain' ? '⚡' : '⚔'}
              <span class="hybrid-reveal-type-badge">${revealedCard.type}</span>
              drawn from deck —
              <strong>${revealedCard.name}</strong>
            </div>
          `}
          ${hybridTyped && html`
            <div class="hybrid-reveal-banner typed">
              ${TYPE_ICON[revealedCard.type] || '📋'}
              <span class="hybrid-reveal-type-badge">${revealedCard.type}</span>
              drawn from deck
              <span class="hybrid-reveal-hint">— draw the matching physical card, then select it below</span>
            </div>
          `}

          <${CardSearch} onSelect=${setSelectedCard} initialQuery=${cardSearchInitialQuery} ownedProducts=${ownedProducts} />

          ${selectedCard && html`<${CardInfo} card=${selectedCard} />`}

          ${lore && html`<${LoreSection} entries=${lore} />`}

          ${selectedCard && html`
            <${ContextualRules}
              cardType=${selectedCard.type}
              cardTraits=${selectedCard.traits || []}
              blessingsLow=${blessingsRemaining != null && blessingsRemaining <= 5}
            />
          `}

          ${isBane && html`
            <${DamageRecorder}
              card=${selectedCard}
              sessionId=${sessionId}
              characters=${characters}
              currentCharId=${currentCharId}
              guidedMode=${guidedMode}
              onUpdate=${onUpdate}
            />
          `}

          <${DiceRoller} onResult=${setDiceTotal} />
        </div>

        ${showPostLore
          ? html`
            <${PostEncounterLore}
              card=${selectedCard}
              loreEntries=${lore}
              onContinue=${onClose}
            />
          `
          : showHenchmanClose
          ? html`
            <div class="henchman-close-prompt">
              <div class="henchman-close-title">
                Henchman defeated! Attempt to close ${location.name}?
              </div>
              ${location.to_close && html`
                <div class="henchman-close-condition">
                  <span class="close-confirm-label">Condition</span>
                  <span class="close-confirm-text">${location.to_close}</span>
                </div>
              `}
              ${location.when_closed && location.when_closed !== 'No effect.' && html`
                <div class="henchman-close-condition close-confirm-reward">
                  <span class="close-confirm-label">Reward</span>
                  <span class="close-confirm-text">${location.when_closed}</span>
                </div>
              `}
              <div class="henchman-close-actions">
                <button class="btn-secondary btn-sm"
                  onClick=${() => handleHenchmanClose(false)}
                  disabled=${henchmanCloseBusy}>
                  Skip
                </button>
                <button class="btn-primary btn-sm"
                  onClick=${() => handleHenchmanClose(true)}
                  disabled=${henchmanCloseBusy}>
                  ${henchmanCloseBusy ? 'Closing…' : 'Close Location'}
                </button>
              </div>
            </div>
          `
          : html`
            <div class="encounter-actions">
              <button class="btn-defeated" onClick=${() => resolve('defeated')}
                disabled=${busy}>
                ${isBoon ? '✦ Acquired' : '✓ Defeated'}
              </button>
              <button class="btn-evaded" onClick=${() => resolve('evaded')}
                disabled=${busy}>
                ↩ Evaded
              </button>
              <button class="btn-failed" onClick=${() => resolve('failed')}
                disabled=${busy}>
                ✗ Failed
              </button>
            </div>
          `
        }
      </div>
    </div>
  `;
}
