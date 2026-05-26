import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { Modal } from '/static/js/components/common/Modal.js';
import { useState, useEffect, useCallback } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

export function CampaignHome() {
  const { state, patch, navigate, toast } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

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

  return html`
    <div class="page">
      <div class="page-header">
        <h1>⚱ Mummy's Mask</h1>
      </div>
      <div class="page-body">
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
                    <span>Created ${new Date(c.created_at).toLocaleDateString()}</span>
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
        <button class="btn-primary" onClick=${() => setShowNew(true)}>+ New Campaign</button>
      </div>

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
        </${Modal}>
      `}
    </div>
  `;
}
