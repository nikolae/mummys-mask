import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { BlessingDeck } from '/static/js/components/play/BlessingDeck.js';
import { LocationCard } from '/static/js/components/play/LocationCard.js';
import { CharacterBar } from '/static/js/components/play/CharacterBar.js';
import { PostScenarioView } from '/static/js/components/play/PostScenarioView.js';
import { EncounterPanel } from '/static/js/components/encounter/EncounterPanel.js';
import { RulesPanel } from '/static/js/components/common/RulesPanel.js';
import { GameTeacher } from '/static/js/components/common/GameTeacher.js';
import { GuidedBanner } from '/static/js/components/common/GuidedBanner.js';
import { CharacterSheet } from '/static/js/components/character/CharacterSheet.js';
import { useState, useEffect, useCallback } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

export function PlayBoard() {
  const { state, navigate, toast } = useApp();
  const { guidedMode } = state;
  const { sessionId } = state;

  const [session, setSession]           = useState(null);
  const [currentCharId, setCurrentCharId] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [encounter, setEncounter]       = useState(null); // location being explored
  const [revealedCard, setRevealedCard] = useState(null); // card revealed by hybrid explore
  const [showRules, setShowRules]       = useState(false);
  const [showTeacher, setShowTeacher]   = useState(false);
  const [sheetChar, setSheetChar]       = useState(null); // character sheet overlay

  const loadSession = useCallback(async () => {
    try {
      const s = await api.getSession(sessionId);
      setSession(s);
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

  // Auto-switch selected char to current player on turn advance
  useEffect(() => {
    if (session?.current_player) setCurrentCharId(session.current_player);
  }, [session?.current_player]);

  async function handleExplore(loc) {
    // Always call action_explore so the deck is decremented (and popped in hybrid mode)
    try {
      const updated = await api.actionExplore(sessionId, { location_id: loc.id });
      setSession(updated);
      setRevealedCard(updated?._revealed_card ?? null);
      // Use the freshly-updated location so card count is correct in the panel
      const freshLoc = updated?.locations?.find(l => l.id === loc.id) ?? loc;
      setEncounter(freshLoc);
    } catch (e) {
      toast('Explore failed: ' + e.message, 'error');
    }
  }

  if (loading) {
    return html`<div class="loading-center"><div class="spinner"></div></div>`;
  }
  if (!session) {
    return html`<div class="loading-center">Session not found</div>`;
  }

  const { status, blessings_remaining, scenario_id, locations, characters, current_player, turn_number } = session;
  const campaignId = session.campaign_id;

  // Guided-mode step for play — derived from session state
  const currentChar = characters?.find(c => c.id === current_player);
  const openLocations = locations?.filter(l => l.is_open) ?? [];
  const playGuidedStep = (() => {
    if (blessings_remaining <= 5) return {
      icon: '⚠️',
      title: `Urgent — Only ${blessings_remaining} Blessing${blessings_remaining !== 1 ? 's' : ''} Left!`,
      body: 'The timer is almost out. Focus on closing locations and cornering the villain — don\'t waste explorations on boons you don\'t need.',
      tip: 'If you find the villain now, all other characters should try to temporarily close their locations so the villain can\'t escape.',
    };
    return {
      icon: '🎯',
      title: currentChar ? `${currentChar.name}'s Turn (Turn ${turn_number})` : `Turn ${turn_number}`,
      body: [
        `1. Advance the Blessings deck — flip the top card face-up. (The app records this automatically when you tap "End Turn".)`,
        `2. Explore — tap "Explore" on ${currentChar?.name ?? 'the current character'}\'s location card to flip the top card of that deck.`,
        '3. End Turn — tap "End Turn" in the bar below when you\'re done to pass to the next player.',
      ],
      tip: openLocations.length <= 2
        ? `Only ${openLocations.length} location${openLocations.length !== 1 ? 's' : ''} left open — focus on closing them and trapping the villain!`
        : 'Allies at the same location can play 1 Blessing each to add a die to your check. Ask before you roll!',
    };
  })();

  // Post-scenario view (won or lost) — replaces inline status screens
  if (status === 'won' || status === 'lost') {
    return html`
      <${PostScenarioView}
        session=${session}
        campaignId=${campaignId}
        onDone=${() => navigate('setup')}
      />
    `;
  }

  const [advId] = (scenario_id || '1-1').split('-');

  return html`
    <div class="play-board">
      <!-- Top bar -->
      <div class="play-topbar">
        <button class="btn-icon btn-ghost" style="font-size:18px; flex-shrink:0;"
          onClick=${() => navigate('setup')}>←</button>
        <div class="scenario-title">
          <div class="scenario-name">Scenario ${scenario_id}</div>
          <div class="adventure-name">Adventure ${advId}</div>
        </div>
        <${BlessingDeck} remaining=${blessings_remaining} total=${30} />
        <button class="btn-icon btn-ghost play-help-btn" title="Rules Reference"
          onClick=${() => setShowRules(true)}>?</button>
        <button class="btn-ghost play-teach-btn" title="How to Play"
          onClick=${() => setShowTeacher(true)}>How to Play</button>
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
            onExplore=${handleExplore}
          />
        `)}
      </div>

      <!-- Guided mode banner -->
      ${guidedMode && !encounter && html`
        <div class="play-guided-wrap">
          <${GuidedBanner}
            icon=${playGuidedStep.icon}
            title=${playGuidedStep.title}
            body=${playGuidedStep.body}
            tip=${playGuidedStep.tip}
          />
        </div>
      `}

      <!-- Character bar -->
      <${CharacterBar}
        session=${session}
        currentCharId=${currentCharId}
        onSelectChar=${setCurrentCharId}
        onOpenSheet=${setSheetChar}
        onUpdate=${loadSession}
      />

      <!-- Encounter panel (slides up when exploring) -->
      ${encounter && html`
        <${EncounterPanel}
          location=${encounter}
          sessionId=${sessionId}
          blessingsRemaining=${blessings_remaining}
          characters=${characters}
          currentCharId=${currentCharId}
          revealedCard=${revealedCard}
          onClose=${() => { setEncounter(null); setRevealedCard(null); }}
          onUpdate=${loadSession}
        />
      `}

      <!-- Rules reference drawer -->
      ${showRules && html`
        <${RulesPanel} onClose=${() => setShowRules(false)} />
      `}

      <!-- Game teacher walkthrough -->
      ${showTeacher && html`
        <${GameTeacher} onClose=${() => setShowTeacher(false)} />
      `}

      <!-- Character sheet overlay -->
      ${sheetChar && html`
        <${CharacterSheet}
          character=${sheetChar}
          onClose=${() => setSheetChar(null)}
        />
      `}
    </div>
  `;
}
