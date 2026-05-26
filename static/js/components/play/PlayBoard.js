import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { BlessingDeck } from '/static/js/components/play/BlessingDeck.js';
import { LocationCard } from '/static/js/components/play/LocationCard.js';
import { CharacterBar } from '/static/js/components/play/CharacterBar.js';
import { useState, useEffect, useCallback } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

export function PlayBoard() {
  const { state, patch, navigate, toast } = useApp();
  const { sessionId } = state;

  const [session, setSession] = useState(null);
  const [currentCharId, setCurrentCharId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const s = await api.getSession(sessionId);
      setSession(s);
      // Default select current player
      if (!currentCharId && s.current_player) {
        setCurrentCharId(s.current_player);
      }
    } catch (e) {
      toast('Failed to load session', 'error');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [sessionId]);

  // Auto-update current char to current player on turn change
  useEffect(() => {
    if (session?.current_player) setCurrentCharId(session.current_player);
  }, [session?.current_player]);

  if (loading) {
    return html`<div class="loading-center"><div class="spinner"></div></div>`;
  }
  if (!session) {
    return html`<div class="loading-center">Session not found</div>`;
  }

  const { status, blessings_remaining, scenario_id, locations, characters } = session;

  if (status === 'won') {
    return html`
      <div class="status-won">
        <div class="status-icon">🏆</div>
        <div class="status-title">Victory!</div>
        <div class="status-sub">Scenario ${scenario_id} complete</div>
        <button class="btn-primary btn-lg" style="margin-top:16px;"
          onClick=${() => navigate('setup')}>Continue Campaign</button>
      </div>
    `;
  }
  if (status === 'lost') {
    return html`
      <div class="status-lost">
        <div class="status-icon">💀</div>
        <div class="status-title">Defeat</div>
        <div class="status-sub">The blessings have run out…</div>
        <button class="btn-primary btn-lg" style="margin-top:16px;"
          onClick=${() => navigate('setup')}>Try Again</button>
      </div>
    `;
  }

  // Split scenario id: "1-1" → adventure "1"
  const [advId] = (scenario_id || '1-1').split('-');
  const advName = advId ? `Adventure ${advId}` : '';

  return html`
    <div class="play-board">
      <!-- Top bar -->
      <div class="play-topbar">
        <button class="btn-icon btn-ghost" style="font-size:18px; flex-shrink:0;"
          onClick=${() => navigate('setup')}>←</button>
        <div class="scenario-title">
          <div class="scenario-name">Scenario ${scenario_id}</div>
          <div class="adventure-name">${advName}</div>
        </div>
        <${BlessingDeck} remaining=${blessings_remaining} total=${30} />
      </div>

      <!-- Location grid -->
      <div class="location-grid">
        ${locations.map(loc => html`
          <${LocationCard}
            key=${loc.id}
            location=${loc}
            characters=${characters}
            currentCharId=${currentCharId}
            sessionId=${sessionId}
            onUpdate=${loadSession}
          />
        `)}
      </div>

      <!-- Character bar -->
      <${CharacterBar}
        session=${session}
        currentCharId=${currentCharId}
        onSelectChar=${setCurrentCharId}
        onUpdate=${loadSession}
      />
    </div>
  `;
}
