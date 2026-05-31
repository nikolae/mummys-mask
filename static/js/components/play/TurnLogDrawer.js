import { html } from '/static/js/html.js';
import { useState, useEffect } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_ICON = {
  explore:            '🔍',
  encounter_defeated: '✓',
  encounter_evaded:   '↩',
  encounter_failed:   '✗',
  close_location:     '🔒',
  temp_close_location:'🔒',
  end_turn:           '→',
  move:               '🚶',
  damage:             '💔',
  set_hand:           '✋',
  session_created:    '🎲',
};

function formatEntry(entry, charMap, locMap) {
  const { action_type, character_id, details } = entry;
  const d = details || {};
  const who = character_id ? (charMap[character_id] ?? 'Unknown') : null;
  const loc = d.location_id ? (locMap[d.location_id] ?? d.location_id) : null;

  switch (action_type) {
    case 'explore':
      return who
        ? `${who} explored ${loc ?? '—'}${d.revealed_card?.name ? ` → ${d.revealed_card.name}` : ''}`
        : `Explored ${loc ?? '—'}`;

    case 'encounter_defeated':
      return [
        who ? `${who} defeated${d.card_name ? ` ${d.card_name}` : ''}` : `Defeated ${d.card_name ?? ''}`,
        d.dice_total != null ? ` (rolled ${d.dice_total})` : '',
        d.escaped_to ? ` — villain fled to ${d.escaped_to}!` : '',
      ].join('');

    case 'encounter_evaded':
      return `${who ?? '?'} evaded${d.card_name ? ` ${d.card_name}` : ''}`;

    case 'encounter_failed':
      return [
        `${who ?? '?'} failed vs${d.card_name ? ` ${d.card_name}` : ' —'}`,
        d.dice_total != null ? ` (rolled ${d.dice_total})` : '',
      ].join('');

    case 'close_location':
      return `${who ?? '?'} closed ${loc ?? '—'}`;

    case 'temp_close_location':
      return `${who ?? '?'} temp-closed ${loc ?? '—'}`;

    case 'move':
      return `${who ?? '?'} moved to ${d.to_location_id ? (locMap[d.to_location_id] ?? d.to_location_id) : '—'}`;

    case 'end_turn':
      return `Turn ended — ${d.blessings_remaining} blessing${d.blessings_remaining !== 1 ? 's' : ''} left`;

    case 'damage':
      return `${who ?? '?'} took ${d.amount ?? '?'} damage`;

    case 'set_hand':
      return `${who ?? '?'} hand set to ${d.count ?? '?'}`;

    case 'session_created':
      return 'Session started';

    default:
      return action_type.replace(/_/g, ' ');
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TurnLogDrawer({ sessionId, characters, locations, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Build lookup maps for IDs → names
  const charMap = {};
  for (const c of characters || []) charMap[c.id] = c.name;

  const locMap = {};
  for (const l of locations || []) locMap[l.id] = l.name;

  useEffect(() => {
    api.getSessionLog(sessionId)
      .then(rows => setEntries(rows))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Group entries by turn number (entries are newest-first from API)
  const byTurn = {};
  for (const e of entries) {
    const t = e.turn_number;
    if (!byTurn[t]) byTurn[t] = [];
    byTurn[t].push(e);
  }
  const turns = Object.keys(byTurn).map(Number).sort((a, b) => b - a);

  return html`
    <div class="turn-log-backdrop" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="turn-log-drawer">
        <div class="turn-log-header">
          <span class="turn-log-title">📜 Action Log</span>
          <button class="modal-close btn-icon" onClick=${onClose}
            style="min-height:36px; min-width:36px; font-size:18px;">✕</button>
        </div>

        <div class="turn-log-body">
          ${loading && html`<div class="turn-log-loading">Loading…</div>`}
          ${!loading && entries.length === 0 && html`
            <div class="turn-log-empty">No actions recorded yet.</div>
          `}
          ${turns.map(t => html`
            <div key=${t} class="turn-log-group">
              <div class="turn-log-group-label">Turn ${t}</div>
              ${byTurn[t].map((e, i) => html`
                <div key=${i} class=${'turn-log-entry' + (e.action_type === 'end_turn' ? ' turn-log-entry--end' : '')}>
                  <span class="turn-log-icon">${ACTION_ICON[e.action_type] ?? '·'}</span>
                  <span class="turn-log-text">${formatEntry(e, charMap, locMap)}</span>
                </div>
              `)}
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
