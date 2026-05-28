import { html } from '/static/js/html.js';
import { useState } from '/static/js/vendor/hooks.module.js';

/**
 * LoreBriefingModal — full-screen parchment overlay for narrative lore.
 *
 * Props:
 *   entries    – array of lore entry objects (from /api/lore endpoint)
 *   onClose    – called when user dismisses
 *   doneLabel  – optional override for the final button label (default: "Begin Scenario")
 */
export function LoreBriefingModal({ entries, onClose, doneLabel }) {
  const [idx, setIdx] = useState(0);

  if (!entries?.length) return null;

  const entry   = entries[idx];
  const isLast  = idx === entries.length - 1;
  const total   = entries.length;

  function advance() {
    if (isLast) onClose();
    else setIdx(i => i + 1);
  }

  const blocks = parseTextBlocks(entry.text || '');

  return html`
    <div class="lore-briefing-backdrop" onClick=${e => { if (e.target === e.currentTarget) advance(); }}>
      <div class="lore-briefing-modal">

        <div class="lore-briefing-header">
          <span class="lore-briefing-icon">⚱</span>
          <span class="lore-briefing-label">
            ${entry.title || entry.card_name || 'Adventure Journal'}
          </span>
          ${total > 1 && html`
            <span class="lore-briefing-pager">${idx + 1} / ${total}</span>
          `}
        </div>

        <div class="lore-briefing-body">
          ${blocks.map((b, i) => b.type === 'heading'
            ? html`<div key=${i} class="lore-brief-subhead">${b.text}</div>`
            : html`<p key=${i}>${b.text}</p>`
          )}
        </div>

        <div class="lore-briefing-footer">
          <button class="btn-primary lore-briefing-btn" onClick=${advance}>
            ${isLast ? (doneLabel || 'Begin Scenario') : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Parse a lore text block into an array of { type: 'heading'|'para', text: string } blocks.
 *
 * The lore text comes from PDF extraction with ~115-char wrapped lines and no double-newlines
 * between paragraphs. Strategy:
 *   - A short line (≤ 50 chars) not ending with sentence punctuation is a heading
 *   - Consecutive wrapped content lines are joined into a paragraph
 *   - Blank lines flush the current paragraph
 */
function parseTextBlocks(text) {
  const lines  = text.split('\n');
  const blocks = [];
  let para     = [];

  function flushPara() {
    if (para.length) {
      blocks.push({ type: 'para', text: para.join(' ').trim() });
      para = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      // Blank line → paragraph break
      flushPara();
      continue;
    }

    const isShort      = line.length <= 55;
    const endsSentence = /[.!?]$/.test(line);
    const startsUpper  = /^[A-Z]/.test(line);
    const isHeading    = isShort && !endsSentence && startsUpper;

    if (isHeading) {
      // Flush whatever was accumulating, then emit a heading
      flushPara();
      blocks.push({ type: 'heading', text: line });
    } else {
      // Regular content line — accumulate into current paragraph
      para.push(line);
    }
  }
  flushPara();

  return blocks;
}
