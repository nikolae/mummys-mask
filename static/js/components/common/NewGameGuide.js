import { html } from '/static/js/html.js';
import { useState, useEffect } from '/static/js/vendor/hooks.module.js';

// ── Static data ───────────────────────────────────────────────────────────────

const CHARACTERS = [
  {
    name: 'Alahazra', classLabel: 'Oracle', set: 'base',
    description: 'A seer who can glimpse the future. Strong with Divine spells and can scan location decks. Excellent at supporting allies at range.',
    strengths: ['Knowledge & Divine skills', 'Scry ahead in location decks', 'Remove curses'],
    difficulty: 'Moderate',
    deck: { weapon: 0, spell: 2, armor: 1, item: 2, ally: 2, blessing: 5 },
  },
  {
    name: 'Damiel', classLabel: 'Alchemist', set: 'base',
    description: 'Bomb-tossing treasure-hunter who excels at acquiring boons and exploiting the marketplace. Manipulates traders better than anyone.',
    strengths: ['Dexterity & Craft skills', 'Acquire extra boons from traders', 'Poison & bomb attacks'],
    difficulty: 'Moderate',
    deck: { weapon: 2, spell: 0, armor: 2, item: 3, ally: 2, blessing: 4 },
  },
  {
    name: 'Estra', classLabel: 'Spiritualist', set: 'base',
    description: 'Spirit medium with a ghostly husband as a permanent companion. Strong self-healer, good against Undead, and hard to kill.',
    strengths: ['Divine & Fortitude checks', 'Reduce all damage types', 'Undead expertise'],
    difficulty: 'Easy (survivable)',
    deck: { weapon: 1, spell: 4, armor: 1, item: 1, ally: 3, blessing: 4 },
  },
  {
    name: 'Ezren', classLabel: 'Wizard', set: 'base',
    description: 'The arcane powerhouse. Grows exponentially stronger with each spell feat. Excels at eliminating tough monsters with elemental magic.',
    strengths: ['Arcane Intelligence spells', 'Large die rolls (d12)', 'Learns immunities'],
    difficulty: 'Hard (early game fragile)',
    deck: { weapon: 1, spell: 5, armor: 1, item: 1, ally: 3, blessing: 2 },
  },
  {
    name: 'Simoun', classLabel: 'Rogue', set: 'base',
    description: 'A knife-throwing half-sylph who churns through cards rapidly. High mobility and multiple explorations per turn are her specialty.',
    strengths: ['Dexterity & Ranged attacks', 'Multiple explorations', 'Evasion & movement'],
    difficulty: 'Moderate',
    deck: { weapon: 4, spell: 0, armor: 2, item: 2, ally: 2, blessing: 2 },
  },
  {
    name: 'Yoon', classLabel: 'Kineticist', set: 'base',
    description: 'Lucky elemental blaster. Uses blast powers that recharge on a die roll. Extremely durable when lucky; devastating against anything weak to Fire.',
    strengths: ['Fortitude & Constitution', 'Fire damage reduction', 'Self-sufficient blasting'],
    difficulty: 'Easy (luck-based)',
    deck: { weapon: 2, spell: 0, armor: 2, item: 1, ally: 4, blessing: 3 },
  },
  {
    name: 'Zadim', classLabel: 'Slayer', set: 'base',
    description: 'Poison-blade assassin. Acid-coated weapons and martial expertise make him the best pure combat character. Also surprisingly good at helping allies.',
    strengths: ['Strength & Melee combat', 'Give cards to allies mid-turn', 'Poison & acid'],
    difficulty: 'Easy (reliable fighter)',
    deck: { weapon: 3, spell: 0, armor: 2, item: 1, ally: 2, blessing: 3 },
  },
  {
    name: 'Ahmotep', classLabel: 'Magus', set: 'addon',
    description: 'Staff-wielding hybrid fighter-caster. Can blend physical and magical attacks. Master of barriers and traps.',
    strengths: ['Arcane & Melee', 'Disarm barriers', 'Versatile spell-sword'],
    difficulty: 'Moderate',
    deck: { weapon: 2, spell: 3, armor: 1, item: 1, ally: 3, blessing: 2 },
  },
  {
    name: 'Channa Ti', classLabel: 'Druid', set: 'addon',
    description: 'Water druid who calls upon spirits of land and water. Thrives as a utility support character — she does a bit of everything.',
    strengths: ['Divine & Nature checks', 'Animal allies', 'Elemental healing'],
    difficulty: 'Moderate',
    deck: { weapon: 1, spell: 2, armor: 1, item: 1, ally: 4, blessing: 2 },
  },
  {
    name: 'Drelm', classLabel: 'Cleric', set: 'addon',
    description: 'Tank cleric with the blessing of Abadar. Can wring an extra boon from any trader. Makes the party richer.',
    strengths: ['Divine & Strength', 'Heavy armors', 'Trader manipulation'],
    difficulty: 'Easy',
    deck: { weapon: 2, spell: 3, armor: 2, item: 1, ally: 1, blessing: 4 },
  },
  {
    name: 'Mavaro', classLabel: 'Occultist', set: 'addon',
    description: 'A collector of implements who adapts to any situation. Changes approach mid-scenario. Starts slow but becomes extraordinarily flexible.',
    strengths: ['Any skill via implements', 'Recharge almost anything', 'Deck flexibility'],
    difficulty: 'Hard (complex to play)',
    deck: { weapon: 2, spell: 1, armor: 1, item: 2, ally: 2, blessing: 3 },
  },
];

const SECTIONS = [
  {
    id: 'welcome',
    icon: '⚱',
    title: 'Welcome — Before You Begin',
    content: [
      'This app is a Game Master companion for the Pathfinder Adventure Card Game: Mummy\'s Mask. It tracks the game state — scenario progress, blessings deck timer, locations, and character advancement — while you and your group play with the physical card game.',
      'You will still need the physical Mummy\'s Mask Base Set (or access to the cards). The app does not replace the physical cards; it manages the bookkeeping so you can focus on the adventure.',
    ],
    checklist: [
      'Mummy\'s Mask Base Set (required)',
      'Character Add-On Deck (optional, adds 4 more characters)',
      'This app running on your tablet or laptop',
      '1–4 players (up to 6 with the Add-On Deck)',
    ],
  },
  {
    id: 'characters',
    icon: '🧙',
    title: 'Step 1 — Choose Your Characters',
    content: [
      'Each player controls one character. The Base Set includes 7 characters; the Character Add-On Deck adds 4 more. Choose before the first session — characters are persistent across the entire campaign.',
      'For beginners, Alahazra (Oracle), Zadim (Slayer), Yoon (Kineticist), or Estra (Spiritualist) are forgiving and straightforward. Avoid Ezren (Wizard) or Mavaro (Occultist) for your first campaign — they require more game knowledge.',
    ],
  },
  {
    id: 'decks',
    icon: '🃏',
    title: 'Step 2 — Build Starting Decks',
    content: [
      'Each character starts with a 15-card deck built from cards in the box. Use only cards marked with the letter B (Base Set) or C (Character Add-On) in the top-right corner. Cards must match the character\'s Cards List exactly.',
      'The rulebook provides a suggested starting deck for each character — these are listed below. Using the suggestions is strongly recommended for your first campaign. After your first scenario, you may trade cards and customise freely.',
    ],
    tip: 'Find cards quickly by sorting all base cards by type first — weapons in one pile, spells in another, etc. Then pull the named cards from each pile.',
  },
  {
    id: 'setup',
    icon: '🗺️',
    title: 'Step 3 — Set Up the First Scenario',
    content: [
      'Your first scenario is B-1: "All That Glitters Begets Gold" from Adventure B: Cross the Pharaoh\'s Land. The villain is the Bonecrusher Master.',
      'In this app, tap "+ New Campaign", give your campaign a name, add each character, then tap "Start Session" to launch the scenario. The app will walk you through location and villain setup.',
    ],
    steps: [
      { n: '1', text: 'Create your campaign in this app and add each character by name and class.' },
      { n: '2', text: 'Select Adventure B → Scenario B-1 to set up your session.' },
      { n: '3', text: 'The app shows how many locations to use based on your player count. Retrieve those location cards from the physical box.' },
      { n: '4', text: 'Build each location deck from the physical cards following the deck list on each location card.' },
      { n: '5', text: 'Stack the villain and henchmen as shown on the scenario card, then place one card on top of each location deck (shuffle each deck after).' },
      { n: '6', text: 'Draw 30 random blessings from the box, shuffle them, and place them face-down — this is your blessings deck (the countdown timer).' },
      { n: '7', text: 'Each player draws a starting hand equal to their character\'s hand size, ensuring it includes at least 1 of their Favored Card Type.' },
    ],
  },
  {
    id: 'first_turn',
    icon: '🎯',
    title: 'Step 4 — Playing Your First Turns',
    content: [
      'On every turn: advance the blessings deck (mandatory), optionally give a card / move, optionally explore your location, optionally try to close if the deck is empty, then reset your hand.',
      'Your first priority is exploring — flip cards and deal with them. Boons (green/gold cards) can be acquired and added to your deck. Banes (red/dark cards) must be fought.',
      'The first scenario is intentionally gentle — the Bonecrusher Master is beatable and the locations are not too punishing. Use it to learn the flow before Adventure 1.',
    ],
    tip: 'Tap the "How to Play" button during your session for an in-game refresher. Tap "?" for the full rules reference.',
  },
  {
    id: 'adventure_b',
    icon: '🏺',
    title: 'Adventure B — Cross the Pharaoh\'s Land',
    content: [
      'Adventure B has 5 scenarios and serves as your tutorial campaign. Completing all 5 earns each character a Power Feat — your first permanent improvement.',
      'After each scenario (win or lose), rebuild your decks: combine all your cards (hand + deck + discard), trade freely between players, then construct a new deck matching your Cards List. After a win, record any feats in this app and optionally visit a trader.',
      'If you lose a scenario, replay it. You keep all feats from previous scenarios but not from the one you just lost.',
    ],
    scenarios: [
      { id: 'B-1', name: 'All That Glitters Begets Gold', villain: 'Bonecrusher Master', reward: 'Traders: Falsin Deek, Hadden Hoppert' },
      { id: 'B-2', name: 'A Sandstorm of Malevolent Will', villain: 'Tukanem-Hanam', reward: 'Loot: Scarab Buckler' },
      { id: 'B-3', name: 'Undead by Initiate', villain: 'Natron Zombie', reward: 'Power Feat (adventure reward)' },
      { id: 'B-4', name: 'The Tainted Tower', villain: 'Crawling Hands', reward: 'Traders: Smiths of Wati, Ghoul Market' },
      { id: 'B-5', name: 'Desecrated by Initiate', villain: 'Natron Zombie', reward: 'Power Feat (adventure reward)' },
    ],
  },
  {
    id: 'progression',
    icon: '⬆️',
    title: 'Campaign Progression',
    content: [
      'After Adventure B, proceed to Adventure 1: The Half-Dead City (scenarios 1-1 through 1-5). Each adventure escalates in difficulty — enemies get tougher and the scourge (curse) die gets bigger.',
      'At Adventure 3, each character chooses a Role Card — a specialisation that unlocks new powers. This is a major milestone. The app prompts role selection automatically when you complete Adventure 2.',
      'The full campaign spans 6 Adventures (B through 6) and 30 scenarios. A complete campaign takes 20–40 hours of play spread across multiple sessions.',
    ],
    tip: 'The app tracks your progress automatically — when you win a scenario it advances to the next one. Just re-open your campaign and the correct scenario is already selected.',
  },
];

// ── Helper sub-components ─────────────────────────────────────────────────────

function CharacterCard({ char, selected, onSelect }) {
  const difficultyColor = { 'Easy': 'var(--accent-green, #4caf50)', 'Easy (survivable)': 'var(--accent-green, #4caf50)', 'Easy (luck-based)': 'var(--accent-green, #4caf50)', 'Moderate': 'var(--accent-yellow, #ffc107)', 'Hard (early game fragile)': 'var(--accent-red, #f44336)', 'Hard (complex to play)': 'var(--accent-red, #f44336)' };
  const col = difficultyColor[char.difficulty] || 'var(--text-dim)';
  return html`
    <div class=${'ng-char-card' + (selected ? ' selected' : '')}
      onClick=${() => onSelect(char.name)}>
      <div class="ng-char-avatar">${char.name[0]}</div>
      <div class="ng-char-body">
        <div class="ng-char-name">${char.name}</div>
        <div class="ng-char-class">${char.classLabel}
          ${char.set === 'addon' ? html`<span class="ng-char-set-badge">Add-On</span>` : null}
        </div>
        <div class="ng-char-difficulty" style="color:${col}; font-size:11px; margin-top:2px;">
          ${char.difficulty}
        </div>
        ${selected && html`
          <div class="ng-char-detail">
            <p>${char.description}</p>
            <div class="ng-char-strengths">
              ${char.strengths.map(s => html`<span key=${s} class="ng-strength-chip">${s}</span>`)}
            </div>
            <div class="ng-deck-list">
              ${Object.entries(char.deck).filter(([,v]) => v > 0).map(([k, v]) => html`
                <span key=${k} class="ng-deck-item"><b>${v}</b> ${k}</span>
              `)}
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function GuideSection({ section }) {
  const [selChar, setSelChar] = useState(null);

  function toggleChar(name) {
    setSelChar(prev => prev === name ? null : name);
  }

  return html`
    <div id=${'ng-sec-' + section.id} class="ng-section">
      <div class="ng-section-header">
        <span class="ng-section-icon">${section.icon}</span>
        <h2 class="ng-section-title">${section.title}</h2>
      </div>

      ${section.content?.map((para, i) => html`
        <p key=${i} class="ng-para">${para}</p>
      `)}

      ${section.checklist && html`
        <ul class="ng-checklist">
          ${section.checklist.map((item, i) => html`
            <li key=${i}>✓ ${item}</li>
          `)}
        </ul>
      `}

      ${section.id === 'characters' && html`
        <div class="ng-chars-grid">
          ${CHARACTERS.map(c => html`
            <${CharacterCard}
              key=${c.name}
              char=${c}
              selected=${selChar === c.name}
              onSelect=${toggleChar}
            />
          `)}
        </div>
        <p class="ng-chars-hint">Tap a character to see their description and starting deck.</p>
      `}

      ${section.steps && html`
        <div class="ng-steps">
          ${section.steps.map(s => html`
            <div key=${s.n} class="ng-step">
              <span class="ng-step-num">${s.n}</span>
              <span class="ng-step-text">${s.text}</span>
            </div>
          `)}
        </div>
      `}

      ${section.scenarios && html`
        <div class="ng-scenarios">
          ${section.scenarios.map(s => html`
            <div key=${s.id} class="ng-scenario-row">
              <span class="ng-scenario-id">${s.id}</span>
              <div class="ng-scenario-body">
                <div class="ng-scenario-name">${s.name}</div>
                <div class="ng-scenario-meta">Villain: ${s.villain} · ${s.reward}</div>
              </div>
            </div>
          `)}
        </div>
      `}

      ${section.tip && html`
        <div class="ng-tip">
          <span class="ng-tip-icon">💡</span>
          <span>${section.tip}</span>
        </div>
      `}
    </div>
  `;
}

// ── Main NewGameGuide ─────────────────────────────────────────────────────────

export function NewGameGuide({ onClose, initialSection = null }) {
  useEffect(() => {
    if (!initialSection) return;
    // rAF ensures the panel has painted before we scroll
    requestAnimationFrame(() => {
      const el = document.getElementById(`ng-sec-${initialSection}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return html`
    <div class="ng-overlay" onClick=${handleBackdrop}>
      <div class="ng-panel">

        <div class="ng-panel-header">
          <div class="ng-header-title">
            <span style="font-size:22px;">🏺</span>
            <span>New Game Guide</span>
          </div>
          <button class="btn-icon btn-ghost" style="font-size:18px; min-height:36px; min-width:36px;"
            onClick=${onClose}>✕</button>
        </div>

        <div class="ng-panel-body">
          ${SECTIONS.map(s => html`<${GuideSection} key=${s.id} section=${s} />`)}
        </div>

        <div class="ng-panel-footer">
          <button class="btn-primary" onClick=${onClose}>Close Guide</button>
        </div>
      </div>
    </div>
  `;
}
