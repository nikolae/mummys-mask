import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { Modal } from '/static/js/components/common/Modal.js';
import { NewGameGuide } from '/static/js/components/common/NewGameGuide.js';
import { GuidedBanner } from '/static/js/components/common/GuidedBanner.js';
import { LoreBriefingModal } from '/static/js/components/common/LoreBriefingModal.js';
import { SettingsModal } from '/static/js/components/common/SettingsModal.js';
import { useState, useEffect, useCallback } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

export function CampaignHome() {
  const { state, patch, navigate, toast, toggleGuided } = useApp();
  const { guidedMode } = state;
  const [showNew, setShowNew]         = useState(false);
  const [showGuide, setShowGuide]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newName, setNewName]         = useState('');
  const [busy, setBusy]               = useState(false);
  const [prologueEntries, setPrologueEntries] = useState(null); // campaign prologue lore

  const load = useCallback(async () => {
    try {
      const campaigns = await api.getCampaigns();
      patch({ campaigns });
    } catch (e) {
      toast('Failed to load campaigns', 'error');
    }
  }, []);

  useEffect(() => { load(); }, []);

  async function createCampaign() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const c = await api.createCampaign(newName.trim());
      setShowNew(false);
      setNewName('');
      await load();
      // Show campaign prologue lore if we haven't shown it for this campaign yet
      const seenKey = `prologue-${c.id}`;
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, '1');
        try {
          const rawEntries = await api.queryLore({ trigger: 'before_campaign' });
          const entries = (rawEntries || []).filter(e => !/epilogue/i.test(e.title || ''));
          if (entries?.length) {
            setPrologueEntries({ entries, campaign: c });
            return; // defer openCampaign until prologue is dismissed
          }
        } catch { /* non-fatal */ }
      }
      openCampaign(c);
    } catch (e) {
      toast('Failed to create campaign', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampaign(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      await api.deleteCampaign(id);
      await load();
      toast('Campaign deleted');
    } catch (e) {
      toast('Failed to delete', 'error');
    }
  }

  function openCampaign(c) {
    navigate('setup', { campaignId: c.id, campaign: c });
  }

  const campaigns = state.campaigns;

  // Guided-mode step for this screen
  const guidedStep = !campaigns || campaigns.length === 0
    ? {
        icon: '⚱',
        title: 'Welcome — Create Your First Campaign',
        body: 'A campaign tracks your party\'s progress across all 30 scenarios. Tap "+ New Campaign" below to begin. Give it any name you like — your party name or something thematic works well.',
        tip: 'You only need one campaign per playthrough. Each player\'s character lives inside it.',
      }
    : {
        icon: '▶',
        title: 'Open Your Campaign',
        body: 'Tap your campaign card to continue setting it up. You\'ll add your characters, pick your first scenario, and then start playing.',
      };

  return html`
    <div class="page">
      <div class="page-header">
        <h1>⚱ Mummy's Mask</h1>
        <div class="page-header-actions">
          <button class="btn-ghost btn-sm settings-btn"
            onClick=${() => setShowSettings(true)}
            title="Content ownership settings">
            ⚙
          </button>
          <button class=${'btn-ghost btn-sm guided-toggle' + (guidedMode ? ' guided-toggle--on' : '')}
            onClick=${toggleGuided}
            title=${guidedMode ? 'Guided mode is on — tap to turn off' : 'Turn on step-by-step guidance'}>
            🎓 ${guidedMode ? 'Guided: On' : 'New Player?'}
          </button>
        </div>
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
        ${campaigns === null
          ? html`<div class="loading-center"><div class="spinner"></div><span>Loading…</span></div>`
          : campaigns.length === 0
          ? html`
            <div class="empty-state">
              <h3>No campaigns yet</h3>
              <p>Create a campaign to begin your adventure.</p>
            </div>`
          : html`
            <div class="campaign-grid">
              ${campaigns.map(c => html`
                <div key=${c.id} class="campaign-card" onClick=${() => openCampaign(c)}>
                  <h3>${c.name}</h3>
                  <div class="campaign-meta">
                    <span>${c.character_count} character${c.character_count !== 1 ? 's' : ''}</span>
                    <span>${c.current_scenario
                      ? `Scenario ${c.current_scenario}`
                      : 'Not started'}</span>
                  </div>
                  <div style="margin-top:auto; display:flex; justify-content:flex-end;">
                    <button class="btn-danger btn-sm"
                      onClick=${(e) => deleteCampaign(e, c.id)}
                      style="min-height:32px; padding:0 10px; font-size:12px;">
                      Delete
                    </button>
                  </div>
                </div>
              `)}
            </div>`
        }
      </div>
      <div class="page-footer">
        <button class="btn-ghost" onClick=${() => setShowGuide(true)}
          style="margin-right:8px;">
          🏺 New Game Guide
        </button>
        <button class="btn-primary" onClick=${() => setShowNew(true)}>+ New Campaign</button>
      </div>

      ${showSettings && html`
        <${SettingsModal} onClose=${() => setShowSettings(false)} />
      `}

      ${showGuide && html`
        <${NewGameGuide} initialSection="characters" onClose=${() => setShowGuide(false)} />
      `}

      ${prologueEntries && html`
        <${LoreBriefingModal}
          entries=${prologueEntries.entries}
          doneLabel="Begin Campaign"
          onClose=${() => { setPrologueEntries(null); openCampaign(prologueEntries.campaign); }}
        />
      `}

      ${showNew && html`
        <${Modal} title="New Campaign" onClose=${() => setShowNew(false)}
          footer=${html`
            <button class="btn-secondary" onClick=${() => setShowNew(false)}>Cancel</button>
            <button class="btn-primary" onClick=${createCampaign} disabled=${busy || !newName.trim()}>
              Create
            </button>
          `}>
          <div class="field">
            <label>Campaign Name</label>
            <input
              type="text"
              placeholder="e.g. Wati Expedition"
              value=${newName}
              onInput=${e => setNewName(e.target.value)}
              onKeyDown=${e => e.key === 'Enter' && createCampaign()}
              autofocus
            />
          </div>
          <p style="font-size:12px; color:var(--text-dim); margin-top:10px; margin-bottom:0;">
            First time?${' '}
            <button class="btn-link" onClick=${() => setShowGuide(true)}>Browse characters & setup guide →</button>
          </p>
        </${Modal}>
      `}
    </div>
  `;
}
