import { html } from '/static/js/html.js';
import { useState, useEffect, useRef } from '/static/js/vendor/hooks.module.js';

// ── Individual rule topic expanded view ──────────────────────────────────────

function RuleTopic({ topicId, onClose }) {
  const [topic, setTopic] = useState(null);

  useEffect(() => {
    fetch(`/api/rules/${topicId}`)
      .then(r => r.json())
      .then(setTopic)
      .catch(() => {});
  }, [topicId]);

  if (!topic) {
    return html`<div class="rules-topic-loading"><div class="spinner"></div></div>`;
  }

  return html`
    <div class="rules-topic-detail">
      <button class="rules-back-btn" onClick=${onClose}>← Back</button>
      <div class="rules-topic-header">
        <span class="rules-topic-icon">${topic.icon || '📖'}</span>
        <h2>${topic.title}</h2>
      </div>
      <p class="rules-topic-short">${topic.short}</p>

      ${topic.content && html`
        <div class="rules-content-block">
          ${topic.content.split('\n\n').filter(Boolean).map((para, i) => html`
            <p key=${i}>${para.trim()}</p>
          `)}
        </div>
      `}

      ${topic.steps && html`
        <div class="rules-steps">
          ${topic.steps.map((step, i) => html`
            <div key=${i} class="rules-step">
              <div class="rules-step-name">${step.name}</div>
              <div class="rules-step-text">${step.text}</div>
            </div>
          `)}
        </div>
      `}

      ${topic.items && html`
        <div class="rules-items">
          ${topic.items.map((item, i) => html`
            <div key=${i} class="rules-item">
              <span class="rules-item-name">${item.name}</span>
              <span class="rules-item-text">${item.text}</span>
            </div>
          `)}
        </div>
      `}

      ${topic.notes && html`
        <div class="rules-notes">
          <div class="rules-notes-label">Also note:</div>
          ${topic.notes.map((note, i) => html`
            <div key=${i} class="rules-note">▸ ${note}</div>
          `)}
        </div>
      `}
    </div>
  `;
}

// ── Main RulesPanel drawer ────────────────────────────────────────────────────

export function RulesPanel({ onClose }) {
  const [topics, setTopics]       = useState([]);
  const [query, setQuery]         = useState('');
  const [activeTopic, setActiveTopic] = useState(null);
  const inputRef                  = useRef(null);

  useEffect(() => {
    fetch('/api/rules')
      .then(r => r.json())
      .then(setTopics)
      .catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const filtered = query.trim().length < 2
    ? topics
    : topics.filter(t => {
        const q = query.toLowerCase();
        return t.title.toLowerCase().includes(q)
          || t.short.toLowerCase().includes(q)
          || (t.tags || []).some(tag => tag.includes(q));
      });

  return html`
    <div class="rules-overlay" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="rules-panel">
        <div class="rules-panel-header">
          <div class="rules-panel-title">
            <span style="font-size:20px;">📖</span>
            <span>Rules Reference</span>
          </div>
          <button class="btn-icon btn-ghost" style="font-size:18px;" onClick=${onClose}>✕</button>
        </div>

        ${!activeTopic && html`
          <div class="rules-search-wrap">
            <input
              ref=${inputRef}
              type="text"
              placeholder="Search rules…"
              value=${query}
              onInput=${e => setQuery(e.target.value)}
              class="rules-search-input"
            />
          </div>
        `}

        <div class="rules-panel-body">
          ${activeTopic
            ? html`<${RuleTopic} topicId=${activeTopic} onClose=${() => setActiveTopic(null)} />`
            : filtered.length === 0
              ? html`<div class="rules-empty">No rules found for "${query}"</div>`
              : filtered.map(t => html`
                  <button key=${t.id} class="rules-list-item"
                    onClick=${() => setActiveTopic(t.id)}>
                    <span class="rules-list-icon">${t.icon || '📖'}</span>
                    <div class="rules-list-text">
                      <div class="rules-list-title">${t.title}</div>
                      <div class="rules-list-short">${t.short}</div>
                    </div>
                    <span class="rules-list-arrow">›</span>
                  </button>
                `)
          }
        </div>
      </div>
    </div>
  `;
}
