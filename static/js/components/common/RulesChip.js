import { html } from '/static/js/html.js';
import { useState, useEffect } from '/static/js/vendor/hooks.module.js';

/**
 * RulesChip — a small inline button that expands to show a rule summary.
 *
 * Props:
 *   topicId   — rules topic ID from core.yaml (e.g. 'damage', 'barriers')
 *   label     — button label (e.g. 'Barrier rules')
 *   icon      — optional override icon
 */
export function RulesChip({ topicId, label, icon }) {
  const [open, setOpen]   = useState(false);
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(false);

  function toggle() {
    if (!open && !topic) {
      setLoading(true);
      fetch(`/api/rules/${topicId}`)
        .then(r => r.json())
        .then(data => { setTopic(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
    setOpen(v => !v);
  }

  return html`
    <div class="rules-chip-wrap">
      <button class=${'rules-chip' + (open ? ' open' : '')} onClick=${toggle}>
        <span>${icon || topic?.icon || '📖'}</span>
        <span>${label}</span>
        <span class="rules-chip-caret">${open ? '▲' : '▼'}</span>
      </button>

      ${open && html`
        <div class="rules-chip-body">
          ${loading
            ? html`<div style="text-align:center; padding:8px;"><div class="spinner" style="width:20px;height:20px;border-width:2px;"></div></div>`
            : topic
              ? html`
                  <div class="rules-chip-short">${topic.short}</div>

                  ${topic.steps && html`
                    <div class="rules-chip-steps">
                      ${topic.steps.map((s, i) => html`
                        <div key=${i} class="rules-chip-step">
                          <span class="rules-chip-step-name">${s.name}</span>
                          <span class="rules-chip-step-text">${s.text}</span>
                        </div>
                      `)}
                    </div>
                  `}

                  ${topic.content && html`
                    <div class="rules-chip-content">
                      ${topic.content.split('\n\n').filter(Boolean).slice(0, 2).map((p, i) => html`
                        <p key=${i}>${p.trim()}</p>
                      `)}
                    </div>
                  `}

                  ${topic.items && html`
                    <div class="rules-chip-items">
                      ${topic.items.map((item, i) => html`
                        <div key=${i} class="rules-chip-item">
                          <span class="rules-chip-item-name">${item.name}:</span>
                          ${' '}<span>${item.text}</span>
                        </div>
                      `)}
                    </div>
                  `}

                  ${topic.notes && html`
                    <div class="rules-chip-notes">
                      ${topic.notes.slice(0, 3).map((n, i) => html`
                        <div key=${i}>▸ ${n}</div>
                      `)}
                    </div>
                  `}
                `
              : html`<div style="color:var(--text-dim);">Rule not found.</div>`
          }
        </div>
      `}
    </div>
  `;
}

/**
 * ContextualRules — renders rule chips relevant to the current card type and traits.
 *
 * Props:
 *   cardType     — 'monster' | 'barrier' | 'villain' | 'henchman' | boon type | string
 *   cardTraits   — string[], traits from the card (e.g. ['Undead', 'Trigger', 'Fire'])
 *   blessingsLow — boolean, if true add urgent blessing deck chip
 */
export function ContextualRules({ cardType, cardTraits = [], blessingsLow }) {
  const chips = [];
  const hasTrait = t => cardTraits.some(tr => tr.toLowerCase() === t.toLowerCase());

  // ── Trigger trait — show first, it matters the moment you see the card ──────
  if (hasTrait('Trigger')) {
    chips.push({ topicId: 'trigger_trait', label: 'Trigger!', icon: '⚠️' });
  }

  // ── Card-type rules ─────────────────────────────────────────────────────────
  if (cardType === 'monster') {
    chips.push({ topicId: 'damage',               label: 'Damage rules',    icon: '💥' });
    chips.push({ topicId: 'encountering_a_card',  label: 'Encounter steps', icon: '🃏' });
    chips.push({ topicId: 'attempting_a_check',   label: 'Check steps',     icon: '🎲' });

  } else if (cardType === 'barrier') {
    chips.push({ topicId: 'barriers',             label: 'Barrier rules',   icon: '🚧' });
    chips.push({ topicId: 'attempting_a_check',   label: 'Check steps',     icon: '🎲' });
    chips.push({ topicId: 'closing_a_location',   label: 'Close after',     icon: '🔒' });

  } else if (cardType === 'villain') {
    chips.push({ topicId: 'encountering_villain', label: 'Villain rules',       icon: '⚡' });
    chips.push({ topicId: 'closing_a_location',   label: 'Close locations',     icon: '🔒' });
    chips.push({ topicId: 'villain_escapes',      label: 'If villain escapes',  icon: '💨' });
    chips.push({ topicId: 'rules_to_remember',    label: 'Easy to forget',      icon: '📌' });

  } else if (cardType === 'henchman') {
    chips.push({ topicId: 'closing_a_location',  label: 'Close after defeat', icon: '🔒' });
    chips.push({ topicId: 'damage',              label: 'Damage rules',       icon: '💥' });
    chips.push({ topicId: 'encountering_a_card', label: 'Encounter steps',    icon: '🃏' });

  } else if (['weapon','spell','armor','item','ally','blessing','loot'].includes(cardType)) {
    // Boon encounter
    chips.push({ topicId: 'encountering_a_card', label: 'Encounter steps', icon: '🃏' });
    chips.push({ topicId: 'playing_cards',       label: 'Card fates',      icon: '🎴' });

  } else {
    chips.push({ topicId: 'encountering_a_card', label: 'Encounter steps', icon: '🃏' });
  }

  // ── Trait-specific additions ────────────────────────────────────────────────

  // Scourge — card can inflict a lasting curse
  if (hasTrait('Scourge') || cardType === 'scourge') {
    chips.push({ topicId: 'scourges', label: 'Scourge rules', icon: '🪲' });
  }

  // Invokes hint — when traits matter for card interactions
  if (cardTraits.length >= 2 && (cardType === 'monster' || cardType === 'barrier' || cardType === 'villain')) {
    chips.push({ topicId: 'invokes', label: 'Trait invokes', icon: '🔗' });
  }

  // Faceup hint — if card was on top of the deck face-up
  if (hasTrait('Faceup') || hasTrait('Trigger')) {
    chips.push({ topicId: 'faceup_cards', label: 'Faceup cards', icon: '👁️' });
  }

  // ── Blessings urgency ───────────────────────────────────────────────────────
  if (blessingsLow) {
    chips.push({ topicId: 'blessing_deck', label: '⚠ Blessings critical!', icon: '⏳' });
  }

  // Deduplicate by topicId, preserving first occurrence
  const seen = new Set();
  const deduped = chips.filter(c => {
    if (seen.has(c.topicId)) return false;
    seen.add(c.topicId);
    return true;
  });

  if (!deduped.length) return null;

  return html`
    <div class="contextual-rules">
      <div class="contextual-rules-label">Quick rules</div>
      <div class="contextual-rules-chips">
        ${deduped.map(c => html`
          <${RulesChip} key=${c.topicId} topicId=${c.topicId} label=${c.label} icon=${c.icon} />
        `)}
      </div>
    </div>
  `;
}
