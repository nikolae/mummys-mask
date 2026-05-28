import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { Modal } from '/static/js/components/common/Modal.js';
import { NewGameGuide } from '/static/js/components/common/NewGameGuide.js';
import { GuidedBanner } from '/static/js/components/common/GuidedBanner.js';
import { useState, useEffect, useCallback } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

// ── Starting deck guide ───────────────────────────────────────────────────────

const TYPE_ICON = { weapon:'⚔', spell:'✨', armor:'🛡', item:'🎒', ally:'👥', blessing:'🙏' };
const TYPE_ORDER = ['weapon', 'spell', 'armor', 'item', 'ally', 'blessing'];

function DeckBuildGuide({ template }) {
  if (!template?.starting_deck) return null;
  const deck = template.starting_deck;

  // Collapse duplicates into {name, count} per type
  const groups = TYPE_ORDER
    .filter(t => deck[t]?.length)
    .map(type => {
      const counts = {};
      for (const name of deck[type]) counts[name] = (counts[name] || 0) + 1;
      return { type, cards: Object.entries(counts).map(([name, count]) => ({ name, count })) };
    });

  const total = Object.values(deck).reduce((s, arr) => s + arr.length, 0);

  return html`
    <div class="deck-guide">
      <div class="deck-guide-header">
        <span class="deck-guide-title">Starting Deck — ${total} cards</span>
        <span class="deck-guide-hint">Find these from the physical box</span>
      </div>
      ${groups.map(g => html`
        <div key=${g.type} class="deck-guide-group">
          <span class="deck-guide-type-label">
            ${TYPE_ICON[g.type] || '•'} ${g.type}
          </span>
          <div class="deck-guide-cards">
            ${g.cards.map(({ name, count }) => html`
              <span key=${name} class="deck-guide-card">
                ${count > 1 ? html`<span class="deck-guide-count">×${count}</span>` : null}
                ${name}
              </span>
            `)}
          </div>
        </div>
      `)}
    </div>
  `;
}

// ── Character setup panel ────────────────────────────────────────────────────

function CharacterPanel({ campaignId, characters, characterTemplates, onChange }) {
  const { toast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', hand_size: 4 });
  const [busy, setBusy] = useState(false);

  const selectedTemplate = characterTemplates?.find(t => t.name === form.type);

  async function addCharacter() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.addCharacter(campaignId, {
        name: form.name.trim(),
        character_type: form.type || form.name.trim(),
        hand_size: selectedTemplate?.hand_size ?? form.hand_size,
      });
      setShowAdd(false);
      setForm({ name: '', type: '', hand_size: 4 });
      onChange();
    } catch (e) {
      toast('Failed to add character', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeCharacter(chid) {
    try {
      await api.deleteCharacter(campaignId, chid);
      onChange();
    } catch (e) {
      toast('Failed to remove character', 'error');
    }
  }

  return html`
    <div class="card">
      <div class="card-header">
        <h2>Characters (${characters.length}/6)</h2>
        ${characters.length < 6 && html`
          <button class="btn-ghost btn-sm" onClick=${() => setShowAdd(true)}>+ Add</button>
        `}
      </div>
      ${characters.length === 0
        ? html`<p style="color:var(--text-dim); font-size:13px;">No characters yet.</p>`
        : characters.map(c => html`
          <div key=${c.id} class="char-row">
            <div class="char-avatar">${c.name[0].toUpperCase()}</div>
            <div class="char-info">
              <div class="char-name-big">${c.name}</div>
              <div class="char-type-label">${c.character_type} · Hand ${c.hand_size}</div>
            </div>
            <button class="btn-danger btn-sm"
              style="min-height:32px; padding:0 10px; font-size:12px;"
              onClick=${() => removeCharacter(c.id)}>
              Remove
            </button>
          </div>
        `)
      }

      ${showAdd && html`
        <${Modal} title="Add Character" onClose=${() => setShowAdd(false)}
          footer=${html`
            <button class="btn-secondary" onClick=${() => setShowAdd(false)}>Cancel</button>
            <button class="btn-primary" onClick=${addCharacter} disabled=${busy || !form.name.trim()}>
              Add
            </button>
          `}>
          <div class="field">
            <label>Player Name</label>
            <input type="text" placeholder="e.g. Alex"
              value=${form.name} onInput=${e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown=${e => e.key === 'Enter' && addCharacter()}
              autofocus />
          </div>
          <div class="field">
            <label>Character Class</label>
            <select value=${form.type} onChange=${e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="">— Select class —</option>
              ${(characterTemplates || []).map(t => html`
                <option key=${t.id} value=${t.name}>${t.name}</option>
              `)}
            </select>
          </div>
          ${!selectedTemplate && html`
            <div class="field">
              <label>Hand Size</label>
              <input type="number" min="3" max="7" value=${form.hand_size}
                onInput=${e => setForm(f => ({ ...f, hand_size: parseInt(e.target.value) || 4 }))} />
            </div>
          `}
          ${selectedTemplate && html`<${DeckBuildGuide} template=${selectedTemplate} />`}
          <p style="font-size:12px; color:var(--text-dim); margin-top:10px; margin-bottom:0;">
            Not sure which class to pick?${' '}
            <button class="btn-link" onClick=${() => setShowGuide(true)}>Browse character guide →</button>
          </p>
        </${Modal}>
      `}

      ${showGuide && html`
        <${NewGameGuide} initialSection="characters" onClose=${() => setShowGuide(false)} />
      `}
    </div>
  `;
}

// ── Scenario selector ────────────────────────────────────────────────────────

function ScenarioPanel({ adventures, selectedId, scenarioDetail, onSelect }) {
  // Auto-expand the adventure that contains the currently selected scenario
  const defaultOpen = selectedId ? selectedId.split('-')[0] : null;
  const [openAdv, setOpenAdv] = useState(defaultOpen);

  const henchmen = scenarioDetail?.henchmen || [];

  return html`
    <div class="card">
      <div class="card-header"><h2>Scenario</h2></div>
      ${selectedId && scenarioDetail
        ? html`
          <div class="scenario-selected-summary">
            <div class="scenario-selected-id-row">
              <span class="scenario-selected-id">${selectedId}</span>
              <span class="scenario-selected-name">${scenarioDetail.name}</span>
              <button class="btn-ghost btn-sm" onClick=${() => onSelect(null)}>Change</button>
            </div>
            <div class="scenario-selected-detail">
              <div class="scenario-selected-row">
                <span class="scenario-detail-label">⚡ Villain</span>
                <span class="scenario-detail-villain">${scenarioDetail.villain || '—'}</span>
              </div>
              ${henchmen.length > 0 && html`
                <div class="scenario-selected-row">
                  <span class="scenario-detail-label">⚔ Henchmen</span>
                  <div class="scenario-detail-henchmen">
                    ${henchmen.map(h => html`<span key=${h} class="scenario-henchman-tag">${h}</span>`)}
                  </div>
                </div>
              `}
              ${scenarioDetail.during && html`
                <div class="scenario-selected-row scenario-during-row">
                  <span class="scenario-detail-label">📜 During</span>
                  <span class="scenario-detail-during">${scenarioDetail.during}</span>
                </div>
              `}
            </div>
          </div>`
        : selectedId
          ? html`<p style="color:var(--gold-light); font-size:14px; margin-bottom:8px;">
              Selected: ${selectedId}
              <button class="btn-ghost btn-sm" style="margin-left:8px;"
                onClick=${() => onSelect(null)}>Change</button>
            </p>`
          : null
      }
      ${(adventures || []).map(adv => html`
        <div key=${adv.id} style="margin-bottom:4px;">
          <button class="btn-secondary btn-sm" style="width:100%; justify-content:space-between;"
            onClick=${() => setOpenAdv(openAdv === adv.id ? null : adv.id)}>
            <span>Adventure ${adv.id}: ${adv.name}</span>
            <span>${openAdv === adv.id ? '▲' : '▼'}</span>
          </button>
          ${openAdv === adv.id && html`
            <div class="scenario-list" style="margin-top:4px; padding-left:8px;">
              ${(adv.scenarios || []).map(s => html`
                <div key=${s.id} class=${'scenario-item' + (selectedId === s.id ? ' selected' : '')}
                  onClick=${() => { onSelect(s.id); setOpenAdv(null); }}>
                  <span class="scenario-id">${s.id}</span>
                  <div class="scenario-info">
                    <div class="scenario-item-name">${s.name}</div>
                    ${s.villain && html`<div class="scenario-villain">Villain: ${s.villain}</div>`}
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      `)}
    </div>
  `;
}

// ── Location deck build guide ─────────────────────────────────────────────────

const BANE_ICON  = { monster: '👹', barrier: '🚧' };
const BOON_ICON  = { weapon: '⚔', spell: '✨', armor: '🛡', item: '🎒', ally: '👥', blessing: '🙏' };
const DECK_ORDER = ['monster', 'barrier', 'weapon', 'spell', 'armor', 'item', 'ally', 'blessing'];

function LocationDeckGuide({ detail }) {
  if (!detail) return null;

  const deckList = detail.deck_list || {};
  const total    = Object.values(deckList).reduce((s, v) => s + (v || 0), 0);
  const groups   = DECK_ORDER.filter(t => deckList[t] > 0);

  return html`
    <div class="loc-deck-guide">
      <div class="loc-deck-guide-header">
        <span class="loc-deck-guide-title">Deck: ${total} cards</span>
        <span class="loc-deck-guide-size">pull from the box</span>
      </div>

      <div class="loc-deck-breakdown">
        ${groups.map(type => html`
          <span key=${type} class=${'loc-deck-type loc-deck-' + (BANE_ICON[type] ? 'bane' : 'boon')}>
            ${BANE_ICON[type] || BOON_ICON[type]} ${deckList[type]}${' '}${type}
          </span>
        `)}
      </div>

      ${(detail.at_location || detail.to_close) && html`
        <div class="loc-rules-mini">
          ${detail.at_location && html`
            <div class="loc-rule-mini-row">
              <span class="loc-rule-mini-label">Here</span>
              <span class="loc-rule-mini-text">${detail.at_location}</span>
            </div>
          `}
          ${detail.to_close && html`
            <div class="loc-rule-mini-row">
              <span class="loc-rule-mini-label">Close</span>
              <span class="loc-rule-mini-text">${detail.to_close}</span>
            </div>
          `}
          ${detail.when_closed && detail.when_closed !== 'No effect.' && html`
            <div class="loc-rule-mini-row">
              <span class="loc-rule-mini-label">On close</span>
              <span class="loc-rule-mini-text">${detail.when_closed}</span>
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

// ── Scenario setup checklist ─────────────────────────────────────────────────

function ScenarioSetupGuide({ scenario, selectedLocations, hybridMode }) {
  if (!scenario || selectedLocations.length === 0) return null;

  const [advId] = scenario.id.split('-');
  const henchmen = scenario.henchmen || [];

  // Build location detail map for fast lookup
  const detailMap = {};
  for (const d of (scenario.location_details || [])) detailMap[d.name] = d;

  let stepNum = 1;

  return html`
    <div class="card setup-guide-card">
      <div class="card-header">
        <h2>📋 Physical Setup</h2>
        <span class="setup-guide-adv-badge">Adventure Deck ${advId}</span>
      </div>

      <!-- Step 1: Build Location Decks (must exist before villain/henchmen are placed) -->
      <div class="setup-guide-step">
        <div class="setup-guide-step-num">${stepNum++}</div>
        <div class="setup-guide-step-body">
          <div class="setup-guide-step-title">
            Build Location Decks
            <span class="setup-guide-adv-inline">use cards marked "${advId}"</span>
          </div>
          <div class="setup-guide-step-text">
            For each location, find the card types below from your Adventure Deck ${advId} cards and shuffle them together:
          </div>
          <div class="setup-guide-loc-list">
            ${selectedLocations.map(locName => {
              const detail   = detailMap[locName];
              const deckList = detail?.deck_list || {};
              const total    = Object.values(deckList).reduce((s, v) => s + (v || 0), 0);
              const groups   = DECK_ORDER.filter(t => deckList[t] > 0);
              return html`
                <div key=${locName} class="setup-guide-loc-row">
                  <div class="setup-guide-loc-header">
                    <span class="setup-guide-loc-name">${locName}</span>
                    <span class="setup-guide-loc-count">${total} cards</span>
                  </div>
                  <div class="setup-guide-loc-deck">
                    ${groups.map(type => html`
                      <span key=${type} class=${'setup-guide-deck-chip ' + (BANE_ICON[type] ? 'bane' : 'boon')}>
                        ${BANE_ICON[type] || BOON_ICON[type]} ${deckList[type]} ${type}
                      </span>
                    `)}
                    ${total === 0 && html`<span style="color:var(--text-dim); font-size:11px;">No deck data</span>`}
                  </div>
                </div>
              `;
            })}
          </div>
        </div>
      </div>

      <!-- Step 2: Place Villain -->
      <div class="setup-guide-step">
        <div class="setup-guide-step-num">${stepNum++}</div>
        <div class="setup-guide-step-body">
          <div class="setup-guide-step-title">Place the Villain</div>
          ${hybridMode
            ? html`<div class="setup-guide-hybrid-note">✓ App places the villain digitally — skip this step</div>`
            : html`<div class="setup-guide-step-text">
                Shuffle <strong class="setup-guide-villain-name">${scenario.villain || '—'}</strong>${' '}
                face-down into any one location deck. Don't tell the other players which one.
              </div>`
          }
        </div>
      </div>

      <!-- Step 3: Place Henchmen (if any) -->
      ${henchmen.length > 0 && html`
        <div class="setup-guide-step">
          <div class="setup-guide-step-num">${stepNum++}</div>
          <div class="setup-guide-step-body">
            <div class="setup-guide-step-title">Place the Henchmen</div>
            ${hybridMode
              ? html`<div class="setup-guide-hybrid-note">✓ App places henchmen digitally — skip this step</div>`
              : (() => {
                  // Non-villain locations available = total - 1 (the villain's)
                  const nonVillainCount = selectedLocations.length - 1;
                  const canSpread = nonVillainCount >= henchmen.length;
                  return html`<div class="setup-guide-step-text">
                    ${canSpread
                      ? html`Shuffle each henchman face-down into a <em>different</em> location deck (not the villain's):`
                      : nonVillainCount <= 1
                        ? html`Shuffle all henchmen face-down into the <em>one remaining</em> location deck (not the villain's):`
                        : html`Shuffle the henchmen face-down into the remaining ${nonVillainCount} location decks — distribute them as evenly as possible:`
                    }
                    <div class="setup-guide-henchmen-list">
                      ${henchmen.map(h => html`<span key=${h} class="setup-guide-henchman-tag">⚔ ${h}</span>`)}
                    </div>
                  </div>`;
                })()
            }
          </div>
        </div>
      `}

      <!-- Step 4: Blessings Deck -->
      <div class="setup-guide-step">
        <div class="setup-guide-step-num">${stepNum++}</div>
        <div class="setup-guide-step-body">
          <div class="setup-guide-step-title">Build the Blessings Deck <span class="setup-guide-step-subtitle">(the timer)</span></div>
          <div class="setup-guide-step-text">
            Shuffle 30 random Blessing cards face-down into a separate deck and set it beside the table.
            When the last card is flipped, the scenario is lost.
          </div>
        </div>
      </div>

      <!-- Step 5: Draw Starting Hands -->
      <div class="setup-guide-step">
        <div class="setup-guide-step-num">${stepNum++}</div>
        <div class="setup-guide-step-body">
          <div class="setup-guide-step-title">Draw Starting Hands</div>
          <div class="setup-guide-step-text">
            Each character shuffles their personal deck, then draws cards up to their hand size.
            At least one drawn card must match a Favored Card Type — reshuffle and redraw if needed.
          </div>
        </div>
      </div>

      <!-- Scenario reward (reminder) -->
      ${scenario.reward && html`
        <div class="setup-guide-reward-row">
          <span class="setup-guide-reward-label">🎁 Reward on win:</span>
          <span class="setup-guide-reward-text">${scenario.reward}</span>
        </div>
      `}
    </div>
  `;
}

// ── Location selector ────────────────────────────────────────────────────────

function LocationPanel({ scenario, playerCount, selectedLocations, onToggle }) {
  // Track which locations have their deck guide open.
  // Selected locations start expanded; others can be opened manually via ℹ.
  const [expandedLocs, setExpandedLocs] = useState(() => new Set(selectedLocations));

  // Keep in sync with selectedLocations: add newly selected, remove deselected/bumped.
  useEffect(() => {
    setExpandedLocs(new Set(selectedLocations));
  }, [selectedLocations.join(',')]);

  if (!scenario) {
    return html`<div class="card">
      <div class="card-header"><h2>Locations</h2></div>
      <p style="color:var(--text-dim); font-size:13px;">Select a scenario first.</p>
    </div>`;
  }

  // Number of locations = players + 1 (min 2, max scenario count)
  const required = Math.min(Math.max(playerCount + 1, 2), scenario.locations.length);

  // Build map from location_details array
  const detailMap = {};
  for (const d of (scenario.location_details || [])) detailMap[d.name] = d;

  function handleChipClick(loc) {
    const willSelect = !selectedLocations.includes(loc);
    setExpandedLocs(prev => {
      const next = new Set(prev);
      if (willSelect) next.add(loc); else next.delete(loc);
      return next;
    });
    onToggle(loc);
  }

  function handleInfoClick(e, loc) {
    e.stopPropagation();
    setExpandedLocs(prev => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc); else next.add(loc);
      return next;
    });
  }

  return html`
    <div class="card">
      <div class="card-header">
        <h2>Locations</h2>
        <span class="badge badge-gold">${selectedLocations.length}/${required}</span>
      </div>
      <p style="color:var(--text-dim); font-size:12px; margin-bottom:10px;">
        Select ${required} locations for ${playerCount} player${playerCount !== 1 ? 's' : ''}.
        Tap a name to select/deselect; deck details expand automatically when selected.
      </p>
      <div class="location-chip-list">
        ${(scenario.locations || []).map(loc => {
          const sel      = selectedLocations.includes(loc);
          const expanded = expandedLocs.has(loc);
          const detail   = detailMap[loc];
          return html`
            <div key=${loc} class=${'location-chip-row' + (sel ? ' selected' : '')}>
              <div class="location-chip-main" onClick=${() => handleChipClick(loc)}>
                <span class="location-chip-check">${sel ? '✓' : '○'}</span>
                <span class="location-chip-name">${loc}</span>
                ${detail && html`
                  <button class=${'loc-chip-info-btn' + (expanded ? ' active' : '')}
                    onClick=${(e) => handleInfoClick(e, loc)} title="Deck details">ℹ</button>
                `}
              </div>
              ${expanded && detail && html`
                <${LocationDeckGuide} detail=${detail} />
              `}
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ── Main SetupView ───────────────────────────────────────────────────────────

export function SetupView() {
  const { state, patch, navigate, toast, toggleGuided } = useApp();
  const { campaignId, guidedMode, ownedProducts } = state;

  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [adventures, setAdventures] = useState(null);
  const [characterTemplates, setCharacterTemplates] = useState(null);
  const [scenarioId, setScenarioId] = useState(null);
  const [scenarioDetail, setScenarioDetail] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hybridMode, setHybridMode] = useState(false);
  const [activeSession, setActiveSession] = useState(null); // existing playing session

  const playerCount = characters.length;

  const loadCampaign = useCallback(async () => {
    try {
      // Get campaign detail (includes sessions list)
      const detail = await fetch(`/api/campaigns/${campaignId}`).then(r => r.json());
      setCampaign(detail);
      // Find the most recent playing session, if any
      const playing = (detail.sessions || []).find(s => s.status === 'playing');
      setActiveSession(playing || null);
      // Pre-select the campaign's tracked scenario (only if user hasn't picked one yet)
      if (detail.current_scenario) {
        setScenarioId(prev => prev || detail.current_scenario);
      }
      // Load characters
      const res = await fetch(`/api/campaigns/${campaignId}/characters`);
      if (res.ok) setCharacters(await res.json());
    } catch (e) {
      toast('Failed to load campaign', 'error');
    }
  }, [campaignId]);

  function resumeSession() {
    if (!activeSession) return;
    patch({ sessionId: activeSession.id });
    navigate('play');
  }

  useEffect(() => {
    loadCampaign();
    api.getAdventures().then(setAdventures).catch(() => toast('Failed to load adventures', 'error'));
    api.getCharacters().then(setCharacterTemplates).catch(() => {});
  }, [campaignId]);

  // localStorage key scoped to this campaign+scenario so it resets when either changes
  const locStorageKey = scenarioId ? `mm_locs_${campaignId}_${scenarioId}` : null;

  useEffect(() => {
    if (!scenarioId) { setScenarioDetail(null); setSelectedLocations([]); return; }
    const [aid] = scenarioId.split('-');
    api.getScenario(aid, scenarioId).then(s => {
      setScenarioDetail(s);
      const required = Math.min(Math.max(playerCount + 1, 2), s.locations.length);

      // Restore saved picks if they're still valid for this scenario + player count
      try {
        const saved = JSON.parse(localStorage.getItem(`mm_locs_${campaignId}_${scenarioId}`) || 'null');
        if (Array.isArray(saved) && saved.length === required && saved.every(l => s.locations.includes(l))) {
          setSelectedLocations(saved);
          return;
        }
      } catch {}

      // Fall back to auto-selecting the first N locations
      setSelectedLocations(s.locations.slice(0, required));
    }).catch(() => toast('Failed to load scenario', 'error'));
  }, [scenarioId, playerCount]);

  // Persist location picks whenever they change
  useEffect(() => {
    if (locStorageKey && selectedLocations.length > 0) {
      localStorage.setItem(locStorageKey, JSON.stringify(selectedLocations));
    }
  }, [selectedLocations, locStorageKey]);

  function selectScenario(id) {
    setScenarioId(id);
    // Persist the selection immediately so navigating away and back restores it
    if (id) {
      api.updateCampaign(campaignId, {
        current_scenario: id,
        current_adventure: id.split('-')[0],
      }).catch(() => {});
    }
  }

  function toggleLocation(loc) {
    const required = Math.min(Math.max(playerCount + 1, 2), scenarioDetail?.locations.length ?? 99);
    setSelectedLocations(prev => {
      if (prev.includes(loc)) return prev.filter(l => l !== loc);
      if (prev.length >= required) return [...prev.slice(1), loc];
      return [...prev, loc];
    });
  }

  async function startSession() {
    if (!scenarioId || selectedLocations.length === 0 || characters.length === 0) return;
    setBusy(true);
    try {
      // Distribute characters across locations round-robin
      const charLocs = {};
      characters.forEach((c, i) => {
        charLocs[c.id] = selectedLocations[i % selectedLocations.length];
      });
      const session = await api.createSession({
        campaign_id: campaignId,
        scenario_id: scenarioId,
        location_names: selectedLocations,
        character_locations: charLocs,
        hybrid: hybridMode,
      });
      patch({ sessionId: session.id, session });
      navigate('play');
    } catch (e) {
      toast('Failed to start session: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const required = scenarioDetail
    ? Math.min(Math.max(playerCount + 1, 2), scenarioDetail.locations.length)
    : 0;
  const canStart = scenarioId && characters.length > 0
    && selectedLocations.length === required;

  // Guided-mode step for this screen — derived purely from current state
  const guidedStep = (() => {
    if (characters.length === 0) return {
      icon: '🧙',
      title: 'Step 1 — Add Your Characters',
      body: 'Tap "+ Add" in the Characters panel to add each player\'s character. Choose one character class per player — you can tap "Browse character guide →" inside the form if you\'re not sure who to pick.',
      tip: 'Starting out? Zadim (Slayer) and Yoon (Kineticist) are the easiest. Avoid Ezren and Mavaro for your first campaign.',
    };
    if (!scenarioId) return {
      icon: '🗺️',
      title: 'Step 2 — Choose Your Scenario',
      body: 'Open the Scenario panel and pick your first scenario. Expand "Adventure B" and select B-1: All That Glitters Begets Gold. That\'s always the starting scenario for a new campaign.',
    };
    if (!canStart) return {
      icon: '📍',
      title: 'Step 3 — Confirm Your Locations',
      body: `The app has pre-selected ${required} location${required !== 1 ? 's' : ''} for your ${playerCount}-player game. You can swap any of them by tapping a different location chip. When the count shows ${required}/${required} you\'re ready.`,
      tip: 'For your first scenario, the default selection is fine — just leave it as-is.',
    };
    return {
      icon: '✅',
      title: 'Ready to Begin!',
      body: [
        'Before tapping "Begin Scenario", set up your physical cards:',
        '1. Build each location deck from the physical cards using the deck list on each location card.',
        '2. Shuffle the villain and henchmen into the location decks as described on the scenario card.',
        '3. Draw 30 random blessings, shuffle them face-down — that\'s your timer deck.',
        '4. Each player draws a starting hand equal to their hand size (include at least 1 Favored Card Type).',
      ],
      tip: 'Once you\'ve set up the physical cards, tap "Begin Scenario" to start tracking the game.',
    };
  })();

  return html`
    <div class="page">
      <div class="page-header">
        <button class="btn-icon btn-ghost" style="font-size:18px;"
          onClick=${() => navigate('campaigns')}>←</button>
        <div style="flex:1;">
          <h1 style="font-size:18px;">${campaign?.name ?? '…'}</h1>
          <div style="font-size:12px; color:var(--text-dim);">Scenario Setup</div>
        </div>
        <button class=${'btn-ghost play-guided-btn' + (guidedMode ? ' active' : '')}
          title=${guidedMode ? 'Guided mode on — tap to disable' : 'Guided mode off — tap to enable'}
          onClick=${toggleGuided}>
          ${guidedMode ? '🎓 Guided' : '🎓'}
        </button>
      </div>
      <div class="page-body">
        ${guidedMode && html`
          <${GuidedBanner}
            icon=${guidedStep.icon}
            title=${guidedStep.title}
            body=${guidedStep.body}
            tip=${guidedStep.tip}
          />
        `}
        <div class="setup-columns">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <${CharacterPanel}
              campaignId=${campaignId}
              characters=${characters}
              characterTemplates=${(characterTemplates || []).filter(t =>
                !ownedProducts || ownedProducts.includes(t.source || 'base')
              )}
              onChange=${loadCampaign}
            />
            <${ScenarioPanel}
              adventures=${adventures}
              selectedId=${scenarioId}
              scenarioDetail=${scenarioDetail}
              onSelect=${selectScenario}
            />
          </div>
          <div>
            <${LocationPanel}
              scenario=${scenarioDetail}
              playerCount=${playerCount}
              selectedLocations=${selectedLocations}
              onToggle=${toggleLocation}
            />
          </div>
        </div>
        ${scenarioDetail && selectedLocations.length > 0 && html`
          <div style="margin-top:20px;">
            <${ScenarioSetupGuide}
              scenario=${scenarioDetail}
              selectedLocations=${selectedLocations}
              hybridMode=${hybridMode}
            />
          </div>
        `}
      </div>
      <div class="page-footer">
        ${activeSession && html`
          <div class="resume-banner">
            <div class="resume-info">
              <span class="resume-label">Active session</span>
              <span class="resume-detail">Scenario ${activeSession.scenario_id} · Turn ${activeSession.current_turn} · ${activeSession.blessings_remaining} blessings</span>
            </div>
            <button class="btn-primary" onClick=${resumeSession}>
              ▶ Resume
            </button>
          </div>
        `}
        <label class="hybrid-toggle">
          <input type="checkbox" checked=${hybridMode}
            onChange=${e => setHybridMode(e.target.checked)} />
          <span class="hybrid-toggle-label">
            <strong>Hybrid Mode</strong>
            <span class="hybrid-toggle-hint">— app tracks deck contents & places villain/henchmen digitally</span>
          </span>
        </label>
        <button class="btn-primary btn-lg" onClick=${startSession}
          disabled=${busy || !canStart}>
          ${busy ? 'Starting…' : 'Begin Scenario'}
        </button>
      </div>
    </div>
  `;
}
