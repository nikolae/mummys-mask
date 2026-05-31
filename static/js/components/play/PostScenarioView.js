import { html } from '/static/js/html.js';
import { useState, useEffect } from '/static/js/vendor/hooks.module.js';
import { useApp } from '/static/js/state.js';
import { DeckRebuildView } from '/static/js/components/play/DeckRebuildView.js';
import { LoreBriefingModal } from '/static/js/components/common/LoreBriefingModal.js';
import * as api from '/static/js/api.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_ATTRS  = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
const CARD_TYPES  = ['weapon', 'spell', 'armor', 'item', 'ally', 'blessing'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseRewardFeats(reward) {
  const feats = [];
  if (!reward) return feats;
  if (/skill feat/i.test(reward))  feats.push('skill');
  if (/card feat/i.test(reward))   feats.push('card');
  if (/power feat/i.test(reward))  feats.push('power');
  return feats;
}

/**
 * Breaks a reward string into typed parts so each can be explained separately.
 * Returns an array of { type, ... } objects.
 *
 * Handles edge cases from the actual YAML data:
 *   "Loot: Neferekhu, Mask of the Forgotten Pharaoh"  — comma within card name
 *   "Loot: Bronze Sentinel, Trader: Efni Raan"         — comma before Trader:
 *   "Loot: Scarab Brooch Trader: Agymah"               — no separator
 *   "Each character gains a card feat. Trader: X"      — feat + trader
 *   "Each character draws a random weapon..."           — random draw reward
 */
function parseRewardParts(reward) {
  if (!reward) return [];
  const parts = [];

  // Traders: stop before end-of-string or a following period/semicolon
  // Trader names may be comma-separated, but the whole match ends at . or end
  const tradersMatch = reward.match(/Traders?:\s*([^\n.;]+)/i);
  if (tradersMatch) {
    // Each name is a real name, separated by commas — but only up to any "Loot:" keyword
    const raw = tradersMatch[1].replace(/Loot:.*/i, '').trim();
    const names = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (names.length) parts.push({ type: 'traders', names });
  }

  // Loot: capture everything up to a following "Trader:" keyword (with or without comma/space)
  // This correctly handles card names that contain commas.
  const lootMatch = reward.match(/Loot:\s*(.+?)(?=\s*,?\s*Trader:|$)/i);
  if (lootMatch) {
    const card = lootMatch[1].replace(/\.$/, '').trim();
    if (card) parts.push({ type: 'loot', card });
  }

  // Random draw from box
  if (/draws?\s+a\s+random|random.+from\s+the\s+box/i.test(reward)) {
    parts.push({ type: 'random-draw', text: reward });
  }

  // Feat rewards (each type checked independently — a reward can grant multiple)
  if (/skill feat/i.test(reward))  parts.push({ type: 'feat', feat: 'skill' });
  if (/card feat/i.test(reward))   parts.push({ type: 'feat', feat: 'card' });
  if (/power feat/i.test(reward))  parts.push({ type: 'feat', feat: 'power' });

  // Role card selection (adventure 3+)
  if (/chooses?\s+a\s+role\s+card/i.test(reward)) parts.push({ type: 'role' });

  // Boon-type choice
  if (/type of boon/i.test(reward)) parts.push({ type: 'boon-choice' });

  // If nothing matched, emit the raw text as a readable fallback
  if (parts.length === 0) parts.push({ type: 'raw', text: reward });

  return parts;
}

// ── Reward explainer block ─────────────────────────────────────────────────────

function RewardExplainer({ reward }) {
  if (!reward) return null;
  const parts = parseRewardParts(reward);

  return html`
    <div class="post-reward-block">
      <div class="post-reward-label">🎁 Scenario Reward</div>
      ${parts.map((p, i) => {

        if (p.type === 'traders') return html`
          <div key=${i} class="reward-section reward-section--traders">
            <div class="reward-section-head">
              <span class="reward-type-badge reward-badge--traders">🏪 Traders Unlocked</span>
            </div>
            <div class="reward-trader-names">
              ${p.names.map((n, j) => html`<span key=${j} class="reward-trader-chip">${n}</span>`)}
            </div>
            <ol class="reward-steps">
              <li>Note these traders on your campaign sheet — they stay available for every future scenario.</li>
              <li>During the <strong>Deck Rebuilding</strong> step after any scenario, each character may visit one trader to <strong>acquire any card</strong> from that trader's card display.</li>
              <li>The acquired card is added to your deck immediately (it counts toward your deck size).</li>
            </ol>
          </div>
        `;

        if (p.type === 'loot') return html`
          <div key=${i} class="reward-section reward-section--loot">
            <div class="reward-section-head">
              <span class="reward-type-badge reward-badge--loot">📦 Loot Card</span>
              <span class="reward-section-card-name">${p.card}</span>
            </div>
            <ol class="reward-steps">
              <li>Find the <strong>${p.card}</strong> physical card in the game box.</li>
              <li>One character adds it to their deck right now — typically the character who defeated the villain, or whoever the group agrees.</li>
              <li>It counts toward that character's deck size going forward.</li>
            </ol>
          </div>
        `;

        if (p.type === 'feat') return html`
          <div key=${i} class="reward-section reward-section--feat">
            <div class="reward-section-head">
              <span class="reward-type-badge reward-badge--feat">⭐ ${p.feat[0].toUpperCase() + p.feat.slice(1)} Feat</span>
            </div>
            <p class="reward-feat-note">Each character gains a <strong>${p.feat} feat</strong>. Use the panels below to record the choice on each character.</p>
          </div>
        `;

        if (p.type === 'boon-choice') return html`
          <div key=${i} class="reward-section reward-section--boon">
            <div class="reward-section-head">
              <span class="reward-type-badge reward-badge--boon">🎴 Boon Type Choice</span>
            </div>
            <p class="reward-feat-note">After taking your card feat, each character <strong>chooses a card type</strong> (weapon, spell, armor, etc.). During Deck Rebuilding, you may acquire one extra boon of that chosen type.</p>
          </div>
        `;

        if (p.type === 'role') return html`
          <div key=${i} class="reward-section reward-section--feat">
            <div class="reward-section-head">
              <span class="reward-type-badge reward-badge--feat">🃏 Role Card</span>
            </div>
            <p class="reward-feat-note">Each character <strong>selects a Role card</strong> from their character's two options. Place it next to your character card — it unlocks new power feat choices going forward. Use the panels below to record your choice.</p>
          </div>
        `;

        if (p.type === 'random-draw') return html`
          <div key=${i} class="reward-section reward-section--loot">
            <div class="reward-section-head">
              <span class="reward-type-badge reward-badge--loot">🎲 Random Draw</span>
            </div>
            <ol class="reward-steps">
              <li>Each character draws the specified card type(s) <strong>randomly from the game box</strong>.</li>
              <li>Shuffle the eligible cards face-down and each player draws one without looking.</li>
              <li>Add it directly to your deck — it counts toward your deck size.</li>
            </ol>
            <p class="reward-feat-note" style="font-size:11px; margin-top:4px;">${p.text}</p>
          </div>
        `;

        // Fallback — raw text with a gentle note
        return html`
          <div key=${i} class="reward-section">
            <div class="post-reward-text">${p.text}</div>
            <p class="reward-feat-note" style="margin-top:4px;">Follow the instructions above, then proceed to Deck Rebuilding.</p>
          </div>
        `;
      })}
    </div>
  `;
}

function advNumber(scenarioId) {
  const n = parseInt((scenarioId || '').split('-')[0]);
  return isNaN(n) ? 0 : n;
}

function parseFeats(raw) {
  if (!raw || typeof raw === 'string') {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }
  return typeof raw === 'object' ? raw : {};
}

// ── Per-character feat granting panel ─────────────────────────────────────────

function CharFeatPanel({ character, availableFeats, needsRole, roleOptions, scenarioId, campaignId, onSaved, toast }) {
  const existing = parseFeats(character.feats);
  const [sel, setSel]     = useState({ skill: null, card: null });
  const [role, setRole]   = useState(character.role || '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy]   = useState(false);

  const needsSkill = availableFeats.includes('skill');
  const needsCard  = availableFeats.includes('card');
  const hasPower   = availableFeats.includes('power');

  const canSave =
    (!needsSkill || sel.skill) &&
    (!needsCard  || sel.card)  &&
    (!needsRole  || role);

  async function save() {
    setBusy(true);
    try {
      const newFeats = {
        skill: [...(existing.skill || [])],
        card:  [...(existing.card  || [])],
        power: [...(existing.power || [])],
      };

      if (needsSkill && sel.skill)
        newFeats.skill.push({ attribute: sel.skill, scenario: scenarioId });
      if (needsCard && sel.card)
        newFeats.card.push({ card_type: sel.card, scenario: scenarioId });
      if (hasPower)
        newFeats.power.push({ scenario: scenarioId });

      const updates = { feats: newFeats };
      if (needsRole && role) updates.role = role;

      await api.updateCharacter(campaignId, character.id, updates);
      setSaved(true);
      onSaved(character.id, needsCard ? sel.card : null);
    } catch (e) {
      toast('Failed to save ' + character.name + ': ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return html`
      <div class="feat-char-panel feat-char-panel--done">
        <div class="feat-char-header">
          <div class="feat-char-avatar">${character.name[0].toUpperCase()}</div>
          <div class="feat-char-info">
            <div class="feat-char-name">${character.name}</div>
            <div class="feat-char-type">${character.character_type}</div>
          </div>
          <div class="feat-char-check">✓ Saved</div>
        </div>
      </div>
    `;
  }

  return html`
    <div class="feat-char-panel">
      <div class="feat-char-header">
        <div class="feat-char-avatar">${character.name[0].toUpperCase()}</div>
        <div class="feat-char-info">
          <div class="feat-char-name">${character.name}</div>
          <div class="feat-char-type">${character.character_type}</div>
        </div>
      </div>

      ${needsSkill && html`
        <div class="feat-section">
          <div class="feat-section-label">⚡ Skill Feat — choose an attribute</div>
          <div class="feat-choices">
            ${BASE_ATTRS.map(attr => html`
              <button key=${attr}
                class=${'feat-choice' + (sel.skill === attr ? ' selected' : '')}
                onClick=${() => setSel(s => ({ ...s, skill: attr }))}>
                ${attr}
              </button>
            `)}
          </div>
        </div>
      `}

      ${needsCard && html`
        <div class="feat-section">
          <div class="feat-section-label">🃏 Card Feat — choose a card type to add to your deck</div>
          <div class="feat-choices">
            ${CARD_TYPES.map(ct => html`
              <button key=${ct}
                class=${'feat-choice' + (sel.card === ct ? ' selected' : '')}
                onClick=${() => setSel(s => ({ ...s, card: ct }))}>
                ${ct.charAt(0).toUpperCase() + ct.slice(1)}
              </button>
            `)}
          </div>
        </div>
      `}

      ${hasPower && html`
        <div class="feat-section">
          <div class="feat-section-label">✨ Power Feat — auto-granted (consult your character card)</div>
        </div>
      `}

      ${needsRole && html`
        <div class="feat-section">
          <div class="feat-section-label">🎭 Choose Your Role Card (Adventure 3+)</div>
          ${roleOptions.length > 0
            ? html`
              <div class="feat-choices feat-choices--roles">
                ${roleOptions.map(r => html`
                  <button key=${r}
                    class=${'feat-choice feat-choice--role' + (role === r ? ' selected' : '')}
                    onClick=${() => setRole(r)}>
                    ${r}
                  </button>
                `)}
              </div>`
            : html`<p style="color:var(--text-dim); font-size:12px;">No role data available — set role manually.</p>`
          }
        </div>
      `}

      <button class="btn-primary btn-sm feat-save-btn"
        onClick=${save}
        disabled=${busy || !canSave}>
        ${busy ? 'Saving…' : 'Confirm & Save'}
      </button>
    </div>
  `;
}

// ── Non-feat summary for "defeat" or scenarios with no feat reward ─────────────

function NoFeatSummary({ character }) {
  const feats = parseFeats(character.feats);
  const total = (feats.skill?.length || 0) + (feats.card?.length || 0) + (feats.power?.length || 0);
  return html`
    <div class="feat-char-panel feat-char-panel--nodone">
      <div class="feat-char-header">
        <div class="feat-char-avatar">${character.name[0].toUpperCase()}</div>
        <div class="feat-char-info">
          <div class="feat-char-name">${character.name}</div>
          <div class="feat-char-type">${character.character_type}</div>
        </div>
        <div class="feat-char-totals">${total} feat${total !== 1 ? 's' : ''} kept</div>
      </div>
    </div>
  `;
}

// ── Main PostScenarioView ─────────────────────────────────────────────────────

export function PostScenarioView({ session, campaignId, onDone }) {
  const { toast } = useApp();
  const { status, scenario_id, characters } = session;
  const [scenario,      setScenario]      = useState(null);
  const [templates,     setTemplates]     = useState([]);
  const [savedIds,        setSavedIds]        = useState(new Set());
  const [cardFeatChoices, setCardFeatChoices] = useState({});  // charId → cardType
  const [phase,           setPhase]           = useState('feats'); // 'feats' | 'decks'
  const [epilogueLore,  setEpilogueLore]  = useState(null);

  const won = status === 'won';

  useEffect(() => {
    if (!scenario_id) return;
    const [advId] = scenario_id.split('-');
    api.getScenario(advId, scenario_id).then(setScenario).catch(() => {});
    api.getCharacters().then(setTemplates).catch(() => {});
  }, [scenario_id]);

  // Epilogue: surface after the last scenario of each adventure is won
  useEffect(() => {
    if (!won || !scenario_id) return;
    const parts  = scenario_id.split('-');
    const advId  = parts[0];
    const scenNum = parts[1];
    // Adventures B and 1–6 each end at scenario 5
    if (scenNum !== '5') return;
    const key = `epilogue-shown-${advId}`;
    if (localStorage.getItem(key)) return;
    api.queryLore({ trigger: 'before_adventure', adventure: advId })
      .then(entries => {
        const epilogues = (entries || []).filter(e => /epilogue/i.test(e.title || ''));
        if (epilogues.length) {
          localStorage.setItem(key, '1');
          setEpilogueLore(epilogues);
        }
      })
      .catch(() => {});
  }, [won, scenario_id]);

  const reward         = scenario?.reward || '';
  const availableFeats = won ? parseRewardFeats(reward) : [];
  const hasFeats       = availableFeats.length > 0;
  const thisAdvNum     = advNumber(scenario_id);
  const roleSelectNeeded = won && thisAdvNum >= 3;

  function getTemplate(char) {
    return templates.find(t => t.name === char.character_type) || null;
  }

  function markSaved(charId, cardFeatType) {
    setSavedIds(prev => { const s = new Set(prev); s.add(charId); return s; });
    if (cardFeatType) {
      setCardFeatChoices(prev => ({ ...prev, [charId]: cardFeatType }));
    }
  }

  const activeChars   = characters.filter(c => !c.is_dead);
  const allSaved      = activeChars.every(c => savedIds.has(c.id));
  const showFeatPanels = won && (hasFeats || roleSelectNeeded);

  // Deck rebuild phase (victory only)
  if (phase === 'decks') {
    return html`
      <${DeckRebuildView}
        characters=${activeChars}
        campaignId=${campaignId}
        cardFeatChoices=${cardFeatChoices}
        onDone=${onDone}
      />
    `;
  }

  return html`
    <div class="post-scenario-view">

      ${epilogueLore && html`
        <${LoreBriefingModal}
          entries=${epilogueLore}
          onClose=${() => setEpilogueLore(null)}
        />
      `}

      <!-- Result banner -->
      <div class=${'post-result-banner' + (won ? ' post-result-banner--won' : ' post-result-banner--lost')}>
        <div class="post-result-icon">${won ? '🏆' : '💀'}</div>
        <div class="post-result-text">
          <div class="post-result-title">${won ? 'Victory!' : 'Defeat'}</div>
          <div class="post-result-sub">
            Scenario ${scenario_id}${scenario ? ` — ${scenario.name}` : ''}
          </div>
        </div>
      </div>

      <div class="post-scenario-body">

        <!-- Reward block (won only) -->
        ${won && reward && html`<${RewardExplainer} reward=${reward} />`}

        <!-- Defeat message -->
        ${!won && html`
          <div class="post-defeat-msg">
            <p>The blessings ran out — no reward this time.</p>
            <p>Feats earned in previous scenarios are kept. Rebuild your decks and try again.</p>
          </div>
        `}

        <!-- Feat granting panels (victory with feats/role) -->
        ${showFeatPanels && html`
          <div class="post-feat-section">
            <div class="post-feat-section-title">Record feats for each character</div>
            ${activeChars.map(c => html`
              <${CharFeatPanel}
                key=${c.id}
                character=${c}
                availableFeats=${availableFeats}
                needsRole=${roleSelectNeeded && !c.role}
                roleOptions=${getTemplate(c)?.roles || []}
                scenarioId=${scenario_id}
                campaignId=${campaignId}
                onSaved=${markSaved}
                toast=${toast}
              />
            `)}
          </div>
        `}

        <!-- Character summary (defeat or no feats) -->
        ${!showFeatPanels && html`
          <div class="post-feat-section">
            ${activeChars.map(c => html`
              <${NoFeatSummary} key=${c.id} character=${c} />
            `)}
          </div>
        `}

      </div>

      <!-- Footer -->
      <div class="post-scenario-footer">
        ${showFeatPanels && !allSaved && html`
          <div class="post-footer-hint">
            Save feats for all characters, or skip to continue.
          </div>
          <button class="btn-ghost btn-sm" style="margin-bottom:8px;"
            onClick=${() => won ? setPhase('decks') : onDone()}>
            Skip feat recording
          </button>
        `}
        <button class="btn-primary btn-lg post-continue-btn"
          onClick=${() => won ? setPhase('decks') : onDone()}>
          ${won ? '→ Update Decks' : '↩ Try Again'}
        </button>
      </div>
    </div>
  `;
}
