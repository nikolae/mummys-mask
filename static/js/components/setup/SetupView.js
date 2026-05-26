import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { Modal } from '/static/js/components/common/Modal.js';
import { useState, useEffect, useCallback } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

// ── Character setup panel ────────────────────────────────────────────────────

function CharacterPanel({ campaignId, characters, characterTemplates, onChange }) {
  const { toast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
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
        </${Modal}>
      `}
    </div>
  `;
}

// ── Scenario selector ────────────────────────────────────────────────────────

function ScenarioPanel({ adventures, selectedId, onSelect }) {
  const [openAdv, setOpenAdv] = useState(null);

  return html`
    <div class="card">
      <div class="card-header"><h2>Scenario</h2></div>
      ${selectedId
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

// ── Location selector ────────────────────────────────────────────────────────

function LocationPanel({ scenario, playerCount, selectedLocations, onToggle }) {
  if (!scenario) {
    return html`<div class="card">
      <div class="card-header"><h2>Locations</h2></div>
      <p style="color:var(--text-dim); font-size:13px;">Select a scenario first.</p>
    </div>`;
  }

  // Number of locations = players + 1 (min 2, max scenario count)
  const required = Math.min(Math.max(playerCount + 1, 2), scenario.locations.length);

  return html`
    <div class="card">
      <div class="card-header">
        <h2>Locations</h2>
        <span class="badge badge-gold">${selectedLocations.length}/${required}</span>
      </div>
      <p style="color:var(--text-dim); font-size:12px; margin-bottom:10px;">
        Select ${required} locations for ${playerCount} player${playerCount !== 1 ? 's' : ''}.
      </p>
      <div class="location-chips">
        ${(scenario.locations || []).map(loc => {
          const sel = selectedLocations.includes(loc);
          return html`
            <div key=${loc} class=${'location-chip' + (sel ? ' selected' : '')}
              onClick=${() => onToggle(loc)}>
              ${loc}
              ${sel && html`<span style="font-size:16px;">✓</span>`}
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ── Main SetupView ───────────────────────────────────────────────────────────

export function SetupView() {
  const { state, patch, navigate, toast } = useApp();
  const { campaignId } = state;

  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [adventures, setAdventures] = useState(null);
  const [characterTemplates, setCharacterTemplates] = useState(null);
  const [scenarioId, setScenarioId] = useState(null);
  const [scenarioDetail, setScenarioDetail] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [busy, setBusy] = useState(false);

  const playerCount = characters.length;

  const loadCampaign = useCallback(async () => {
    try {
      const campaigns = await api.getCampaigns();
      const c = campaigns.find(x => x.id === campaignId);
      setCampaign(c);
      // Fetch full character list
      const all = await api.getCampaigns();
      // Re-fetch with characters embedded via the campaigns endpoint
      // (the /api/campaigns endpoint returns character_count; we need full list)
      // Use the campaign characters from the session state if available
      const res = await fetch(`/api/campaigns/${campaignId}/characters`);
      if (res.ok) {
        const chars = await res.json();
        setCharacters(chars);
      }
    } catch (e) {
      toast('Failed to load campaign', 'error');
    }
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
    api.getAdventures().then(setAdventures).catch(() => toast('Failed to load adventures', 'error'));
    api.getCharacters().then(setCharacterTemplates).catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    if (!scenarioId) { setScenarioDetail(null); setSelectedLocations([]); return; }
    const [aid, ...rest] = scenarioId.split('-');
    api.getScenario(aid, scenarioId).then(s => {
      setScenarioDetail(s);
      // Auto-select required number of locations
      const required = Math.min(Math.max(playerCount + 1, 2), s.locations.length);
      setSelectedLocations(s.locations.slice(0, required));
    }).catch(() => toast('Failed to load scenario', 'error'));
  }, [scenarioId, playerCount]);

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

  return html`
    <div class="page">
      <div class="page-header">
        <button class="btn-icon btn-ghost" style="font-size:18px;"
          onClick=${() => navigate('campaigns')}>←</button>
        <div>
          <h1 style="font-size:18px;">${campaign?.name ?? '…'}</h1>
          <div style="font-size:12px; color:var(--text-dim);">Scenario Setup</div>
        </div>
      </div>
      <div class="page-body">
        <div class="setup-columns">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <${CharacterPanel}
              campaignId=${campaignId}
              characters=${characters}
              characterTemplates=${characterTemplates}
              onChange=${loadCampaign}
            />
            <${ScenarioPanel}
              adventures=${adventures}
              selectedId=${scenarioId}
              onSelect=${setScenarioId}
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
      </div>
      <div class="page-footer">
        <button class="btn-primary btn-lg" onClick=${startSession}
          disabled=${busy || !canStart}>
          ${busy ? 'Starting…' : 'Begin Scenario'}
        </button>
      </div>
    </div>
  `;
}
