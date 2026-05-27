import { html } from '/static/js/html.js';
import { useState, useEffect } from '/static/js/vendor/hooks.module.js';
import { useApp } from '/static/js/state.js';
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
      onSaved();
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
  const [scenario,  setScenario]  = useState(null);
  const [templates, setTemplates] = useState([]);
  const [savedIds,  setSavedIds]  = useState(new Set());

  const won = status === 'won';

  useEffect(() => {
    if (!scenario_id) return;
    const [advId] = scenario_id.split('-');
    api.getScenario(advId, scenario_id).then(setScenario).catch(() => {});
    api.getCharacters().then(setTemplates).catch(() => {});
  }, [scenario_id]);

  const reward        = scenario?.reward || '';
  const loot          = reward.match(/Loot:\s*([^,\n]+)/i)?.[1]?.trim();
  const availableFeats = won ? parseRewardFeats(reward) : [];
  const hasFeats       = availableFeats.length > 0;
  const thisAdvNum     = advNumber(scenario_id);
  const roleSelectNeeded = won && thisAdvNum >= 3;

  function getTemplate(char) {
    return templates.find(t => t.name === char.character_type) || null;
  }

  function markSaved(charId) {
    setSavedIds(prev => { const s = new Set(prev); s.add(charId); return s; });
  }

  const activeChars   = characters.filter(c => !c.is_dead);
  const allSaved      = activeChars.every(c => savedIds.has(c.id));
  const showFeatPanels = won && (hasFeats || roleSelectNeeded);

  return html`
    <div class="post-scenario-view">

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
        ${won && reward && html`
          <div class="post-reward-block">
            <div class="post-reward-label">🎁 Scenario Reward</div>
            <div class="post-reward-text">${reward}</div>
            ${loot && html`<div class="post-loot-note">📦 Find loot card: ${loot}</div>`}
          </div>
        `}

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
                onSaved=${() => markSaved(c.id)}
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
          <button class="btn-ghost btn-sm" style="margin-bottom:8px;" onClick=${onDone}>
            Skip feat recording
          </button>
        `}
        <button class="btn-primary btn-lg post-continue-btn" onClick=${onDone}>
          ${won ? '→ Continue Campaign' : '↩ Try Again'}
        </button>
      </div>
    </div>
  `;
}
