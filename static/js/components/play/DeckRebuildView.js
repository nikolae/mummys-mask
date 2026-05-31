import { html } from '/static/js/html.js';
import { useState, useEffect, useRef, useCallback } from '/static/js/vendor/hooks.module.js';
import { useApp } from '/static/js/state.js';
import * as api from '/static/js/api.js';

const CARD_TYPE_ORDER = ['weapon', 'spell', 'armor', 'item', 'ally', 'blessing'];
const TYPE_ICON = { weapon: '⚔', spell: '✨', armor: '🛡', item: '🔮', ally: '👤', blessing: '🙏' };

// Flatten a template's starting_deck into [{name, type}, ...]
function flattenStartingDeck(startingDeck) {
  const cards = [];
  for (const [type, names] of Object.entries(startingDeck || {})) {
    for (const name of names) {
      cards.push({ name, type });
    }
  }
  return cards;
}

// ── Card search with type filter ─────────────────────────────────────────────

function AddCardSearch({ onAdd, filterType, ownedProducts }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const [allTypes, setAllTypes] = useState(!filterType);
  const debounce              = useRef(null);

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounce.current);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      const r = await api.searchCards(val, ownedProducts);
      const filtered = allTypes || !filterType ? r : r.filter(c => c.type === filterType);
      setResults(filtered);
      setOpen(filtered.length > 0);
    }, 200);
  }

  function pick(card) {
    onAdd({ name: card.name, type: card.type });
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function toggleFilter() {
    setAllTypes(prev => {
      const next = !prev;
      // Re-run search with new filter
      if (query.length >= 2) {
        api.searchCards(query, ownedProducts).then(r => {
          const filtered = next || !filterType ? r : r.filter(c => c.type === filterType);
          setResults(filtered);
          setOpen(filtered.length > 0);
        });
      }
      return next;
    });
  }

  return html`
    <div class="deck-add-search">
      <div class="deck-add-search-row">
        <input
          type="text"
          class="deck-search-input"
          placeholder=${filterType && !allTypes
            ? `Search ${filterType}s to add…`
            : 'Search any card to add…'}
          value=${query}
          onInput=${handleInput}
          onFocus=${() => results.length && setOpen(true)}
          onBlur=${() => setTimeout(() => setOpen(false), 150)}
        />
        ${filterType && html`
          <button class=${'btn-ghost btn-sm deck-type-toggle' + (allTypes ? '' : ' active')}
            onClick=${toggleFilter}
            title=${allTypes ? 'Currently showing all types — click to restrict to ' + filterType : 'Showing ' + filterType + 's only — click to show all'}>
            ${allTypes ? 'All types' : TYPE_ICON[filterType] + ' ' + filterType + 's only'}
          </button>
        `}
      </div>
      ${open && html`
        <div class="card-search-results deck-search-results">
          ${results.slice(0, 10).map(c => html`
            <div key=${c.name} class="card-search-item" onMouseDown=${() => pick(c)}>
              <span class="csi-name">${c.name}</span>
              <span class="csi-type">${c.type}</span>
            </div>
          `)}
        </div>
      `}
    </div>
  `;
}

// ── Per-character deck editor ─────────────────────────────────────────────────

function CharDeckEditor({ character, template, cardFeatType, campaignId, onSaved, toast, ownedProducts }) {
  const rawContents = character.deck_contents;
  const initial = (Array.isArray(rawContents) && rawContents.length > 0)
    ? rawContents
    : flattenStartingDeck(template?.starting_deck);

  const [cards, setCards]   = useState(initial);
  const [saved, setSaved]   = useState(false);
  const [busy, setBusy]     = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Count how many cards of the feat type exist vs the template baseline
  const templateCount = cardFeatType
    ? (template?.starting_deck?.[cardFeatType]?.length || 0)
    : 0;
  const currentCount = cardFeatType
    ? cards.filter(c => c.type === cardFeatType).length
    : 0;
  const featAdded = currentCount > templateCount;

  function removeCard(idx) {
    setCards(prev => prev.filter((_, i) => i !== idx));
  }

  function addCard(card) {
    setCards(prev => [...prev, { name: card.name, type: card.type }]);
  }

  async function save() {
    setBusy(true);
    try {
      await api.updateCharacter(campaignId, character.id, { deck_contents: cards });
      setSaved(true);
      onSaved(character.id);
    } catch (e) {
      toast('Failed to save ' + character.name + ': ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // Group cards by type (preserving original indices for removal)
  const grouped = {};
  cards.forEach((card, idx) => {
    const t = card.type || 'other';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push({ ...card, _idx: idx });
  });
  const typeOrder = [...CARD_TYPE_ORDER.filter(t => grouped[t]), ...Object.keys(grouped).filter(t => !CARD_TYPE_ORDER.includes(t))];

  return html`
    <div class=${'deck-char-panel' + (saved ? ' deck-char-panel--saved' : '')}>
      <div class="deck-char-header" onClick=${() => setExpanded(e => !e)}>
        <div class="deck-char-avatar">${character.name[0].toUpperCase()}</div>
        <div class="deck-char-info">
          <div class="deck-char-name">${character.name}</div>
          <div class="deck-char-meta">${character.character_type} · ${cards.length} cards</div>
        </div>
        ${saved
          ? html`<div class="deck-char-saved">✓ Saved</div>`
          : cardFeatType && html`
            <div class=${'deck-feat-badge' + (featAdded ? ' fulfilled' : '')}>
              ${featAdded ? '✓' : '+'} ${TYPE_ICON[cardFeatType] || ''} ${cardFeatType}
            </div>
          `
        }
        <span class="deck-char-chevron">${expanded ? '▲' : '▼'}</span>
      </div>

      ${expanded && !saved && html`
        <div class="deck-char-body">

          ${cardFeatType && html`
            <div class=${'deck-feat-prompt' + (featAdded ? ' deck-feat-prompt--done' : '')}>
              ${featAdded
                ? html`<span>✓ ${TYPE_ICON[cardFeatType]} ${cardFeatType} card added to deck</span>`
                : html`<span>Add 1 ${TYPE_ICON[cardFeatType] || ''} <strong>${cardFeatType}</strong> to your deck (card feat)</span>`
              }
            </div>
          `}

          <${AddCardSearch}
            onAdd=${addCard}
            filterType=${featAdded ? null : cardFeatType}
            ownedProducts=${ownedProducts}
          />

          <div class="deck-cards-list">
            ${typeOrder.map(type => html`
              <div key=${type} class="deck-type-group">
                <div class="deck-type-label">
                  ${TYPE_ICON[type] || '📋'} ${type.charAt(0).toUpperCase() + type.slice(1)}
                  <span class="deck-type-count">${grouped[type].length}</span>
                </div>
                <div class="deck-type-chips">
                  ${grouped[type].map(card => html`
                    <span key=${card._idx} class="deck-card-chip">
                      ${card.name}
                      <button class="deck-card-remove" title="Remove"
                        onClick=${() => removeCard(card._idx)}>×</button>
                    </span>
                  `)}
                </div>
              </div>
            `)}
          </div>

          <div class="deck-char-footer">
            <span class="deck-total-count">${cards.length} total cards</span>
            <button class="btn-primary btn-sm"
              onClick=${save}
              disabled=${busy}>
              ${busy ? 'Saving…' : 'Save Deck'}
            </button>
          </div>
        </div>
      `}
    </div>
  `;
}

// ── Main DeckRebuildView ──────────────────────────────────────────────────────

export function DeckRebuildView({ characters, campaignId, cardFeatChoices, onDone }) {
  const { state, toast } = useApp();
  const { ownedProducts } = state;
  const [templates, setTemplates] = useState([]);
  const [savedIds, setSavedIds]   = useState(new Set());

  useEffect(() => {
    api.getCharacters().then(setTemplates).catch(() => {});
  }, []);

  function getTemplate(char) {
    return templates.find(t => t.name === char.character_type) || null;
  }

  function markSaved(charId) {
    setSavedIds(prev => { const s = new Set(prev); s.add(charId); return s; });
  }

  const activeChars = characters.filter(c => !c.is_dead);
  const allSaved = activeChars.every(c => savedIds.has(c.id));

  return html`
    <div class="deck-rebuild-view">
      <div class="deck-rebuild-header">
        <h2>📋 Update Decks</h2>
        <p class="deck-rebuild-subtitle">
          Review each character's deck before the next scenario. Add cards earned from feats,
          and remove any that were permanently lost.
        </p>
      </div>

      <div class="deck-char-list">
        ${activeChars.map(c => html`
          <${CharDeckEditor}
            key=${c.id}
            character=${c}
            template=${getTemplate(c)}
            cardFeatType=${cardFeatChoices[c.id] || null}
            campaignId=${campaignId}
            onSaved=${markSaved}
            toast=${toast}
            ownedProducts=${ownedProducts}
          />
        `)}
      </div>

      <div class="deck-rebuild-footer">
        ${!allSaved && html`
          <button class="btn-ghost btn-sm" onClick=${onDone}>
            Skip — update decks later
          </button>
        `}
        <button class="btn-primary btn-lg"
          onClick=${onDone}
          style=${'margin-left: auto;'}>
          ${allSaved ? '→ Continue Campaign' : '→ Continue without saving all'}
        </button>
      </div>
    </div>
  `;
}
