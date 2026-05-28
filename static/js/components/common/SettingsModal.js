import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';
import { Modal } from '/static/js/components/common/Modal.js';
import { useState, useCallback } from '/static/js/vendor/hooks.module.js';
import * as api from '/static/js/api.js';

// Character-unlocking products
const CHAR_PRODUCTS = [
  {
    id: 'base',
    label: 'Mummy\'s Mask Base Set',
    required: true,
    description: 'Required — core cards and characters.',
    characters: ['Ezren', 'Simoun', 'Yoon', 'Zadim'],
  },
  {
    id: 'class_deck',
    label: 'Class Decks (any)',
    description: 'Pathfinder Society class decks that include Mummy\'s Mask content.',
    characters: ['Alahazra', 'Damiel', 'Estra'],
  },
  {
    id: 'character_addon',
    label: 'Character Add-On Deck',
    description: 'Adds 4 extra characters and expands the party to 6 players.',
    characters: ['Ahmotep', 'Channa Ti', 'Drelm', 'Mavaro'],
  },
];

// Adventure deck expansions (affect card search)
const ADV_DECKS = [
  { id: 'adv_1', label: '1', name: 'The Half-Dead City' },
  { id: 'adv_2', label: '2', name: 'Empty Graves' },
  { id: 'adv_3', label: '3', name: 'Shifting Sands' },
  { id: 'adv_4', label: '4', name: 'Secrets of the Sphinx' },
  { id: 'adv_5', label: '5', name: 'The Slave Trenches of Hakotep' },
  { id: 'adv_6', label: '6', name: 'Pyramid of the Sky Pharaoh' },
];

export function SettingsModal({ onClose }) {
  const { state, patch } = useApp();
  const [owned, setOwned] = useState(() => new Set(state.ownedProducts || ['base', 'class_deck']));
  const [saving, setSaving] = useState(false);

  function toggle(id) {
    if (id === 'base') return; // base is always required
    setOwned(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids, on) {
    setOwned(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const ownedArr = Array.from(owned);
      await api.updateSettings({ owned_products: ownedArr });
      patch({ ownedProducts: ownedArr });
      onClose();
    } catch (e) {
      // non-fatal — close anyway, state is updated in memory
      patch({ ownedProducts: Array.from(owned) });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const advDeckIds = ADV_DECKS.map(d => d.id);
  const allAdvOwned = advDeckIds.every(id => owned.has(id));
  const someAdvOwned = advDeckIds.some(id => owned.has(id));

  return html`
    <${Modal}
      title="Content Ownership"
      onClose=${onClose}
      footer=${html`
        <button class="btn-secondary" onClick=${onClose}>Cancel</button>
        <button class="btn-primary" onClick=${save} disabled=${saving}>
          ${saving ? 'Saving…' : 'Save'}
        </button>
      `}
    >
      <p class="settings-intro">
        Tell the app which products you own. This filters the character picker and card search to only show cards you actually have.
      </p>

      <!-- Character products -->
      <div class="settings-section-label">Characters</div>
      <div class="settings-product-list">
        ${CHAR_PRODUCTS.map(product => html`
          <div key=${product.id}
            class=${'settings-product-row' + (product.required ? ' settings-product-required' : '') + (owned.has(product.id) ? ' settings-product-checked' : '')}
            onClick=${() => toggle(product.id)}
          >
            <div class="settings-product-check">
              ${owned.has(product.id) ? '✓' : ''}
            </div>
            <div class="settings-product-info">
              <div class="settings-product-label">
                ${product.label}
                ${product.required && html`<span class="settings-required-badge">Required</span>`}
              </div>
              <div class="settings-product-desc">${product.description}</div>
              <div class="settings-product-chars">
                ${product.characters.map(c => html`<span key=${c} class="settings-char-chip">${c}</span>`)}
              </div>
            </div>
          </div>
        `)}
      </div>

      <!-- Adventure deck expansions -->
      <div class="settings-section-label" style="margin-top:16px;">
        Adventure Decks
        <button class="btn-link settings-toggle-all"
          onClick=${() => toggleAll(advDeckIds, !allAdvOwned)}>
          ${allAdvOwned ? 'Uncheck all' : 'Check all'}
        </button>
      </div>
      <p class="settings-adv-hint">
        Affects which cards appear in the encounter card search. Check the decks you own.
      </p>
      <div class="settings-adv-grid">
        ${ADV_DECKS.map(deck => html`
          <button key=${deck.id}
            type="button"
            class=${'settings-adv-tile' + (owned.has(deck.id) ? ' settings-adv-checked' : '')}
            onClick=${() => toggle(deck.id)}
            title=${deck.name}
          >
            <span class="settings-adv-num">${deck.label}</span>
            <span class="settings-adv-name">${deck.name}</span>
          </button>
        `)}
      </div>

      <p class="settings-note">
        Villain and henchmen cards are always searchable regardless of deck ownership.
      </p>
    </${Modal}>
  `;
}
