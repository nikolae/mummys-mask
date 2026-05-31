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
import { LoreBriefingModal } from '/static/js/components/common/LoreBriefingModal.js';
import { VillainBroadcast } from '/static/js/components/play/VillainBroadcast.js';
import { ScenarioBriefModal } from '/static/js/components/play/ScenarioBriefModal.js';
import { TurnLogDrawer } from '/static/js/components/play/TurnLogDrawer.js';
import { ThemeToggle } from '/static/js/components/common/ThemeToggle.js';
import { AudioToggle } from '/static/js/components/common/AudioToggle.js';
import { audioManager, SCENARIO_ENV } from '/static/js/audio.js';
import { useState, useEffect, useCallback, useRef } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

// ── Session timer hook ────────────────────────────────────────────────────────

function useSessionTimer(startedAt) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!startedAt) return;
    const startMs = new Date(startedAt).getTime();
    function tick() {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
      rafRef.current = setTimeout(tick, 1000);
    }
    tick();
    return () => clearTimeout(rafRef.current);
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// ── "What now?" lightweight context chip (shown when guided mode is OFF) ──────

function WhatNowChip({ blessingsRemaining, exploredThisTurn, openLocations, currentChar, movedThisTurn }) {
  let icon, text, urgent = false;

  if (blessingsRemaining <= 5) {
    icon = '⚡';
    text = `Only ${blessingsRemaining} blessing${blessingsRemaining !== 1 ? 's' : ''} left — find and trap the villain now!`;
    urgent = true;
  } else if (blessingsRemaining <= 10) {
    icon = '⚠️';
    text = `${blessingsRemaining} blessings left — start closing locations.`;
    urgent = true;
  } else if (exploredThisTurn) {
    const hs = currentChar?.hand_size ?? '?';
    text = `✓ Explored! Refill ${currentChar?.name ?? 'your'} hand to ${hs}, then end the turn.`;
    icon = null;
  } else {
    text = `${currentChar?.name ?? 'Current player'}: explore your location deck, then end your turn.`;
    icon = '👉';
  }

  return html`
    <div class="what-now-wrap">
      <div class=${'what-now-chip' + (urgent ? ' what-now-chip--urgent' : '')}>
        ${icon ? html`<span class="what-now-icon">${icon}</span>` : null}
        ${text}
      </div>
      ${movedThisTurn && !exploredThisTurn && html`
        <div class="move-timing-note">
          🚶 Moved this turn — you may still explore once at your new location.
        </div>
      `}
    </div>
  `;
}

// ── Main PlayBoard ────────────────────────────────────────────────────────────

export function PlayBoard() {
  const { state, navigate, toast, toggleGuided } = useApp();
  const { guidedMode } = state;
  const { sessionId } = state;

  const [session, setSession]           = useState(null);
  const [currentCharId, setCurrentCharId] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [encounter, setEncounter]       = useState(null); // location being explored
  const [revealedCard, setRevealedCard] = useState(null); // card revealed by hybrid explore
  const [showRules, setShowRules]       = useState(false);
  const [showTeacher, setShowTeacher]   = useState(false);
  const [showLog, setShowLog]           = useState(false);
  const [sheetChar, setSheetChar]       = useState(null); // character sheet overlay
  const [briefingEntries, setBriefingEntries] = useState(null);   // lore briefing on session start
  const [showScenarioBrief, setShowScenarioBrief] = useState(false); // rules briefing on session start
  const [villainBroadcast, setVillainBroadcast] = useState(null);    // villain found alert

  const timerStr = useSessionTimer(session?.started_at);

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

  // Show scenario rules briefing once per session (tracked in sessionStorage)
  useEffect(() => {
    if (!session?.scenario_id) return;
    const key = `scenario-briefed-${sessionId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setShowScenarioBrief(true);
  }, [session?.scenario_id, sessionId]);

  // Show lore narrative briefing once per session (tracked in sessionStorage)
  useEffect(() => {
    if (!session?.scenario_id) return;
    const briefKey = `lore-briefed-${sessionId}`;
    if (sessionStorage.getItem(briefKey)) return; // already shown this session

    const scenarioId  = session.scenario_id;
    const [advId, scenNum] = scenarioId.split('-');
    const isFirstOfAdv = scenNum === '1';

    async function fetchBriefing() {
      try {
        const entries = [];
        // Adventure briefing first (before_adventure), only for first scenario of that adventure
        // Filter out "Epilogue" entries — those belong at the end of the previous adventure
        if (isFirstOfAdv) {
          const advLore = await api.queryLore({ trigger: 'before_adventure', adventure: advId });
          const prologues = (advLore || []).filter(e => !/epilogue/i.test(e.title || ''));
          entries.push(...prologues);
        }
        // Scenario intro (before_scenario)
        const scenLore = await api.queryLore({ trigger: 'before_scenario', scenario: scenarioId });
        entries.push(...(scenLore || []));

        sessionStorage.setItem(briefKey, '1');
        if (entries.length) {
          setBriefingEntries(entries);
        }
      } catch { /* non-fatal */ }
    }
    fetchBriefing();
  }, [session?.scenario_id, sessionId]);

  // Auto-switch selected char to current player on turn advance
  useEffect(() => {
    if (session?.current_player) setCurrentCharId(session.current_player);
  }, [session?.current_player]);

  // ── Ambient audio ─────────────────────────────────────────────────────────
  // Start when scenario is known; stop on unmount (navigating away).
  useEffect(() => {
    if (!session?.scenario_id) return;
    audioManager.setEnabled(state.ambientEnabled !== false);
    audioManager.setAmbientVolume(state.ambientVolume ?? 0.55);
    const env = SCENARIO_ENV[session.scenario_id];
    if (env) audioManager.startAmbient(env);
    return () => audioManager.stopAmbient(1.5);
  }, [session?.scenario_id]);

  // Sync enabled/volume changes from Settings without restarting audio
  useEffect(() => { audioManager.setEnabled(state.ambientEnabled !== false); }, [state.ambientEnabled]);
  useEffect(() => { audioManager.setAmbientVolume(state.ambientVolume ?? 0.55); }, [state.ambientVolume]);

  async function handleExplore(loc) {
    try {
      const updated = await api.actionExplore(sessionId, { location_id: loc.id });
      setSession(updated);
      const revealed = updated?._revealed_card ?? null;
      setRevealedCard(revealed);
      const freshLoc = updated?.locations?.find(l => l.id === loc.id) ?? loc;
      setEncounter(freshLoc);
      // In hybrid mode, fire villain broadcast immediately when villain is drawn
      if (revealed?.type === 'villain') {
        const openLocs = updated?.locations?.filter(l => l.is_open) ?? [];
        setVillainBroadcast({ villainLocation: freshLoc, openLocations: openLocs });
      }
    } catch (e) {
      toast('Explore failed: ' + e.message, 'error');
    }
  }

  // Called by EncounterPanel when user manually selects a villain card (physical mode)
  function handleVillainSpotted() {
    if (villainBroadcast) return; // already showing
    const openLocs = session?.locations?.filter(l => l.is_open) ?? [];
    setVillainBroadcast({ villainLocation: encounter, openLocations: openLocs });
  }

  if (loading) {
    return html`<div class="loading-center"><div class="spinner"></div></div>`;
  }
  if (!session) {
    return html`<div class="loading-center">Session not found</div>`;
  }

  const { status, blessings_remaining, scenario_id, locations, characters,
          current_player, turn_number, explored_this_turn, villain_last_seen,
          moved_this_turn } = session;
  const campaignId = session.campaign_id;

  // Parse villain last-seen indicator
  const villainSeen = villain_last_seen
    ? (typeof villain_last_seen === 'object'
        ? villain_last_seen
        : { location: villain_last_seen, turn: null })
    : null;

  // Blessing urgency levels
  const blessingCrisis  = blessings_remaining <= 5;
  const blessingWarning = blessings_remaining <= 10 && !blessingCrisis;

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

        <!-- Villain last-seen indicator -->
        ${villainSeen && html`
          <div class="villain-seen-chip" title="Villain last seen">
            <span class="villain-seen-icon">⚡</span>
            <span class="villain-seen-text">
              ${villainSeen.location}${villainSeen.turn ? ` (T${villainSeen.turn})` : ''}
            </span>
          </div>
        `}

        <!-- Session timer -->
        <div class="session-timer" title="Session time">${timerStr}</div>

        <${BlessingDeck} remaining=${blessings_remaining} total=${30} />
        <button class="btn-icon btn-ghost play-log-btn" title="Action Log"
          onClick=${() => setShowLog(true)}>📋</button>
        <button class="btn-icon btn-ghost play-help-btn" title="Rules Reference"
          onClick=${() => setShowRules(true)}>?</button>
        <button class=${'btn-ghost play-guided-btn' + (guidedMode ? ' active' : '')}
          title=${guidedMode ? 'Guided mode on — tap to disable' : 'Guided mode off — tap to enable'}
          onClick=${toggleGuided}>
          ${guidedMode ? '🎓 Guided' : '🎓'}
        </button>
        <button class="btn-ghost play-teach-btn" title="How to Play"
          onClick=${() => setShowTeacher(true)}>How to Play</button>
        <${AudioToggle} small=${true} />
        <${ThemeToggle} small=${true} />
      </div>

      <!-- Blessing urgency banner -->
      ${(blessingCrisis || blessingWarning) && !encounter && html`
        <div class=${'blessing-urgency-banner' + (blessingCrisis ? ' crisis' : ' warning')}>
          <span class="blessing-urgency-icon">${blessingCrisis ? '💀' : '⚠️'}</span>
          <span class="blessing-urgency-text">
            ${blessingCrisis
              ? `Only ${blessings_remaining} blessing${blessings_remaining !== 1 ? 's' : ''} left — focus on finding and trapping the villain!`
              : `${blessings_remaining} blessings remaining — start closing locations soon.`
            }
          </span>
        </div>
      `}

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
            exploredThisTurn=${!!explored_this_turn && loc.characters_here?.includes(currentCharId)}
          />
        `)}
      </div>

      <!-- "What now?" chip — visible when guided mode is OFF -->
      ${!guidedMode && !encounter && html`
        <div class="play-guided-wrap">
          <${WhatNowChip}
            blessingsRemaining=${blessings_remaining}
            exploredThisTurn=${!!explored_this_turn}
            openLocations=${openLocations}
            currentChar=${currentChar}
            movedThisTurn=${moved_this_turn === current_player}
          />
        </div>
      `}

      <!-- Guided mode banner — full step-by-step (guided mode ON) -->
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
          scenarioId=${scenario_id}
          blessingsRemaining=${blessings_remaining}
          characters=${characters}
          currentCharId=${currentCharId}
          revealedCard=${revealedCard}
          onClose=${() => { setEncounter(null); setRevealedCard(null); }}
          onUpdate=${loadSession}
          onVillainSpotted=${handleVillainSpotted}
        />
      `}

      <!-- Villain-spotted broadcast (full-screen, dismissable) -->
      ${villainBroadcast && !encounter && html`
        <${VillainBroadcast}
          villainLocation=${villainBroadcast.villainLocation}
          openLocations=${villainBroadcast.openLocations}
          characters=${characters}
          onDismiss=${() => setVillainBroadcast(null)}
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

      <!-- Scenario rules briefing (shown once per session, before lore) -->
      ${showScenarioBrief && html`
        <${ScenarioBriefModal}
          scenarioId=${scenario_id}
          onClose=${() => setShowScenarioBrief(false)}
        />
      `}

      <!-- Lore narrative briefing (shown once per session, after rules briefing) -->
      ${!showScenarioBrief && briefingEntries && html`
        <${LoreBriefingModal}
          entries=${briefingEntries}
          onClose=${() => setBriefingEntries(null)}
        />
      `}

      <!-- Turn / action log drawer -->
      ${showLog && html`
        <${TurnLogDrawer}
          sessionId=${sessionId}
          characters=${characters}
          locations=${locations}
          onClose=${() => setShowLog(false)}
        />
      `}
    </div>
  `;
}
