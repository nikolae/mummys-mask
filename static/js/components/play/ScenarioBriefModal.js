import { html } from '/static/js/html.js';
import { useState, useEffect } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

/**
 * ScenarioBriefModal — rules summary shown at session start.
 * Pulls live data from the scenario YAML so the GM always sees
 * villain, henchmen, special rules, and reward before turn 1.
 *
 * Props:
 *   scenarioId  – e.g. "1-1"
 *   onClose     – dismiss callback
 */
export function ScenarioBriefModal({ scenarioId, onClose }) {
  const [scenario, setScenario] = useState(null);

  useEffect(() => {
    if (!scenarioId) return;
    const [advId] = scenarioId.split('-');
    api.getScenario(advId, scenarioId)
      .then(setScenario)
      .catch(() => onClose()); // If data unavailable, skip
  }, [scenarioId]);

  // Auto-dismiss after 4 s if the fetch hangs — never leave the user stuck.
  // Cancelled as soon as `scenario` arrives (data loaded) or component unmounts.
  useEffect(() => {
    if (scenario) return; // data already here, no need for a failsafe
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [scenario]);

  if (!scenario) return html`
    <div class="scenario-brief-backdrop">
      <div class="scenario-brief-modal">
        <div class="scenario-brief-loading">Loading scenario…</div>
        <button class="btn-ghost btn-sm" onClick=${onClose}
          style="display:block; margin:12px auto 4px;">
          Skip
        </button>
      </div>
    </div>
  `;

  const henchmen = scenario.henchmen || [];

  return html`
    <div class="scenario-brief-backdrop" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="scenario-brief-modal">

        <div class="scenario-brief-header">
          <div class="scenario-brief-id">Scenario ${scenarioId}</div>
          <div class="scenario-brief-name">${scenario.name}</div>
        </div>

        <div class="scenario-brief-body">

          <!-- Villain -->
          <div class="scenario-brief-section">
            <div class="scenario-brief-section-label">⚡ Villain</div>
            <div class="scenario-brief-villain">${scenario.villain || '—'}</div>
          </div>

          <!-- Henchmen -->
          ${henchmen.length > 0 && html`
            <div class="scenario-brief-section">
              <div class="scenario-brief-section-label">⚔ Henchmen</div>
              <div class="scenario-brief-henchmen">
                ${henchmen.map((h, i) => html`
                  <span key=${i} class="scenario-brief-henchman">${h}</span>
                `)}
              </div>
            </div>
          `}

          <!-- During the scenario special rules -->
          ${scenario.during && html`
            <div class="scenario-brief-section">
              <div class="scenario-brief-section-label">📜 During the Scenario</div>
              <div class="scenario-brief-during">${scenario.during}</div>
            </div>
          `}

          <!-- Reward -->
          ${scenario.reward && html`
            <div class="scenario-brief-section scenario-brief-reward-section">
              <div class="scenario-brief-section-label">🎁 Reward</div>
              <div class="scenario-brief-reward">${scenario.reward}</div>
            </div>
          `}

        </div>

        <div class="scenario-brief-footer">
          <button class="btn-primary scenario-brief-btn" onClick=${onClose}>
            Ready — Begin
          </button>
        </div>
      </div>
    </div>
  `;
}
