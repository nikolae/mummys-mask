import { html } from '/static/js/html.js';
import { useState, useEffect } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFeats(raw) {
  if (!raw || typeof raw === 'string') {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }
  return raw;
}

function skillBonus(derived_from, skillFeats) {
  // derived_from looks like "Strength +2" or "Charisma +0"
  const match = derived_from?.match(/^(\w+)\s*([+-]\d+)$/);
  if (!match) return derived_from || '?';
  const [, attr, base] = match;
  const baseNum = parseInt(base);
  const bonuses = (skillFeats || []).filter(f => f.attribute === attr).length;
  const total = baseNum + bonuses;
  const sign = total >= 0 ? '+' : '';
  return `${attr} ${sign}${total}${bonuses > 0 ? ` (${bonuses} feat${bonuses > 1 ? 's' : ''})` : ''}`;
}

const FEAT_ICONS = { skill: '⚡', card: '🃏', power: '✨' };

// ── CharacterSheet ────────────────────────────────────────────────────────────

export function CharacterSheet({ character, onClose }) {
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    api.getCharacters().then(templates => {
      const t = templates.find(t => t.name === character.character_type);
      setTemplate(t || null);
    }).catch(() => {});
  }, [character.character_type]);

  const feats = parseFeats(character.feats);
  const skillFeats  = feats.skill  || [];
  const cardFeats   = feats.card   || [];
  const powerFeats  = feats.power  || [];
  const totalFeats  = skillFeats.length + cardFeats.length + powerFeats.length;

  const skills = template?.skills || {};

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${handleBackdrop}>
      <div class="sheet-panel">

        <!-- Header -->
        <div class="sheet-header">
          <div class="sheet-avatar">${character.name[0].toUpperCase()}</div>
          <div class="sheet-identity">
            <div class="sheet-name">${character.name}</div>
            <div class="sheet-class">${character.character_type}</div>
            ${character.role && html`
              <div class="sheet-role">🎭 ${character.role}</div>
            `}
          </div>
          <button class="btn-icon btn-ghost sheet-close" onClick=${onClose}>✕</button>
        </div>

        <div class="sheet-body">

          <!-- Stats row -->
          <div class="sheet-stats-row">
            <div class="sheet-stat">
              <div class="sheet-stat-val">${character.hand_size}</div>
              <div class="sheet-stat-label">Hand Size</div>
            </div>
            <div class="sheet-stat">
              <div class="sheet-stat-val">${totalFeats}</div>
              <div class="sheet-stat-label">Feats Earned</div>
            </div>
            ${character.is_dead ? html`
              <div class="sheet-stat sheet-stat--dead">
                <div class="sheet-stat-val">💀</div>
                <div class="sheet-stat-label">Incapacitated</div>
              </div>
            ` : null}
          </div>

          <!-- Skills -->
          ${Object.keys(skills).length > 0 && html`
            <div class="sheet-section">
              <div class="sheet-section-title">Skills</div>
              <div class="sheet-skills">
                ${Object.entries(skills).map(([name, info]) => html`
                  <div key=${name} class="sheet-skill-row">
                    <span class="sheet-skill-name">${name}</span>
                    <span class="sheet-skill-val">${skillBonus(info.derived_from, skillFeats)}</span>
                  </div>
                `)}
              </div>
            </div>
          `}

          <!-- Proficiencies -->
          ${template?.proficiencies?.length > 0 && html`
            <div class="sheet-section">
              <div class="sheet-section-title">Proficiencies</div>
              <div class="sheet-prof-list">
                ${template.proficiencies.map(p => html`
                  <span key=${p} class="sheet-prof-chip">${p}</span>
                `)}
              </div>
            </div>
          `}

          <!-- Feats -->
          <div class="sheet-section">
            <div class="sheet-section-title">Feats</div>
            ${totalFeats === 0
              ? html`<p class="sheet-empty-feats">No feats earned yet.</p>`
              : html`
                <div class="sheet-feats">
                  ${skillFeats.length > 0 && html`
                    <div class="sheet-feat-group">
                      <div class="sheet-feat-group-label">${FEAT_ICONS.skill} Skill Feats</div>
                      ${skillFeats.map((f, i) => html`
                        <div key=${i} class="sheet-feat-item">
                          +1 ${f.attribute}
                          <span class="sheet-feat-scenario">from ${f.scenario}</span>
                        </div>
                      `)}
                    </div>
                  `}
                  ${cardFeats.length > 0 && html`
                    <div class="sheet-feat-group">
                      <div class="sheet-feat-group-label">${FEAT_ICONS.card} Card Feats</div>
                      ${cardFeats.map((f, i) => html`
                        <div key=${i} class="sheet-feat-item">
                          +1 ${f.card_type?.charAt(0).toUpperCase()}${f.card_type?.slice(1)} slot
                          <span class="sheet-feat-scenario">from ${f.scenario}</span>
                        </div>
                      `)}
                    </div>
                  `}
                  ${powerFeats.length > 0 && html`
                    <div class="sheet-feat-group">
                      <div class="sheet-feat-group-label">${FEAT_ICONS.power} Power Feats</div>
                      ${powerFeats.map((f, i) => html`
                        <div key=${i} class="sheet-feat-item">
                          Power feat (see character card)
                          <span class="sheet-feat-scenario">from ${f.scenario}</span>
                        </div>
                      `)}
                    </div>
                  `}
                </div>
              `
            }
          </div>

          <!-- Roles available -->
          ${template?.roles?.length > 0 && html`
            <div class="sheet-section">
              <div class="sheet-section-title">Available Roles</div>
              <div class="sheet-roles">
                ${template.roles.map(r => html`
                  <span key=${r}
                    class=${'sheet-role-chip' + (r === character.role ? ' current' : '')}>
                    ${r === character.role ? '✓ ' : ''}${r}
                  </span>
                `)}
              </div>
            </div>
          `}

        </div>
      </div>
    </div>
  `;
}
