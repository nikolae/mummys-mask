import { html } from '/static/js/html.js';
import { useState } from '/static/js/vendor/hooks.module.js';

// ── Lesson content ────────────────────────────────────────────────────────────

const LESSONS = [
  {
    id: 'overview',
    icon: '🏺',
    title: 'Welcome to Mummy\'s Mask',
    body: `You are a team of adventurers exploring ancient tombs in the desert nation of Osirion. Each scenario challenges you to hunt down a dangerous Villain hiding among several Locations before time runs out.

The party wins together — or loses together. No one player controls the outcome alone.`,
    tip: 'This app tracks the game state. You still use physical cards for your character decks and location decks.'
  },
  {
    id: 'blessing_deck',
    icon: '⏳',
    title: 'The Blessings Deck — Your Timer',
    body: `The blessings deck (shown at the top of the screen) starts with 30 cards. At the start of EVERY player\'s turn, one card is discarded. When the deck is empty and someone tries to advance it, the party immediately loses.

Blessings can also be played from your hand to add extra dice to any check — yours or a teammate\'s. They\'re powerful and versatile, but spending them now means fewer turns overall.`,
    tip: 'Think of each blessing as a question: "Is this check worth a turn?" The answer is often yes early on, less so when you\'re close to the end.'
  },
  {
    id: 'turn_structure',
    icon: '🎯',
    title: 'Your Turn — Six Steps',
    steps: [
      { n: '1', label: 'Advance Blessings', text: 'Discard the top card of the blessings deck. Required — don\'t forget!' },
      { n: '2', label: 'Give a Card', text: 'Optionally hand 1 card from your hand to another character at your location.' },
      { n: '3', label: 'Move', text: 'Optionally move your token to a different location.' },
      { n: '4', label: 'Explore', text: 'Flip the top card of your current location deck and deal with it.' },
      { n: '5', label: 'Close a Location', text: 'If your deck is empty, attempt to close this location.' },
      { n: '6', label: 'End Turn', text: 'Reset your hand to your hand size, then pass left.' },
    ],
    tip: 'Steps 2-5 are optional, but exploring is almost always worth doing — more cards cleared = closer to the villain.'
  },
  {
    id: 'exploring',
    icon: '🃏',
    title: 'Exploring — What You Might Find',
    body: `When you explore, you flip the top card of your location\'s deck. Two possibilities:

BOON (weapon, spell, item, ally, blessing) — Try to acquire it! Succeed at the Check to Acquire and put it in your hand. Fail and it\'s banished from the game. If you choose not to try, it\'s also banished.

BANE (monster, barrier, henchman, villain) — You MUST try to defeat it. Succeed and it\'s banished. Fail a monster and take damage equal to the margin of failure. Fail a barrier and it shuffles back into the deck.`,
    tip: 'Other characters at your location can help by each playing 1 blessing to add dice to your check. Coordinate!'
  },
  {
    id: 'checks',
    icon: '🎲',
    title: 'Attempting a Check',
    body: `Every card you encounter lists skills you can use. Pick one skill, roll its die, add the modifier — that\'s your result. You need to meet or beat the difficulty number.

Your character card shows each skill as a die type + modifier. Example: Strength d10+1 means roll a 10-sided die and add 1.

You can play up to 1 card of each type (weapon, spell, ally, etc.) to add more dice. The encountering character handles their own check — friends can only assist by playing blessings.`,
    tip: 'No skill for the check? You can still roll a d4 with no modifier. It\'s a long shot, but sometimes that\'s all you\'ve got.'
  },
  {
    id: 'damage',
    icon: '💥',
    title: 'Taking Damage',
    body: `Failed a monster check? It bites back. Damage = the difficulty number minus your roll result.

To absorb damage, discard that many cards from your hand. Choose wisely — losing a key weapon or spell hurts. If your hand runs dry, you absorb the remaining damage with your deck instead. Run out of deck cards and your character dies.

Armors, some allies, and certain powers can reduce damage. You can play 1 card of each type to reduce damage from the same source.`,
    tip: 'Letting a weak character take a big hit when their deck is nearly empty can kill them. Communicate health levels!'
  },
  {
    id: 'closing',
    icon: '🔒',
    title: 'Closing Locations',
    body: `You need to close all locations before you can permanently defeat the Villain. Two ways to get the chance:

1. Defeat a Henchman whose card says you may attempt to close its location.
2. Reach the end of your turn with an empty location deck.

Then attempt the location\'s "When Closing" requirement (a skill check listed on the location card). If you succeed: search for villains. None found → location permanently closed! Villain found → location stays open, but you know exactly where the villain is hiding.`,
    tip: 'Splitting the party to close multiple locations simultaneously is often the winning strategy.'
  },
  {
    id: 'villain',
    icon: '⚡',
    title: 'Defeating the Villain',
    body: `When the Villain is revealed, two things happen immediately:

1. Every character at any OTHER open location may attempt to temporarily close their location. A temporary close prevents the villain escaping through it — this turn only.

2. You fight the villain. Succeed at the Check to Defeat AND have no remaining open locations → YOU WIN!

If the villain escapes (you failed, or open locations remain), it shuffles into one of the still-open location decks along with some blessings from the box. The hunt continues!`,
    tip: 'The villain card and scenario card often have special rules — read them before the fight!'
  },
  {
    id: 'between_games',
    icon: '🏕️',
    title: 'After the Scenario',
    body: `Win or lose, every character rebuilds their deck: combine everything you have (hand + deck + discard pile), trade freely between players, then construct a deck that exactly matches your character card\'s card list.

After winning: earn the scenario reward (usually a feat — a permanent character improvement), then optionally visit a trader to swap out cards.

After losing: no reward. You must replay the scenario. Characters keep all feats earned in previous scenarios.`,
    tip: 'Card feats let you add 1 more card of a type to your deck. Skill feats add +1/+2/+3 to a skill. Power feats unlock new abilities.'
  },
];

// ── GameTeacher component ─────────────────────────────────────────────────────

export function GameTeacher({ onClose }) {
  const [step, setStep] = useState(0);
  const lesson = LESSONS[step];
  const isFirst = step === 0;
  const isLast  = step === LESSONS.length - 1;

  function prev() { if (!isFirst) setStep(s => s - 1); }
  function next() { if (!isLast)  setStep(s => s + 1); else onClose(); }

  return html`
    <div class="teacher-overlay" onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="teacher-modal">
        <!-- Header -->
        <div class="teacher-header">
          <span class="teacher-header-label">How to Play</span>
          <button class="btn-icon btn-ghost" style="font-size:16px; min-height:36px; min-width:36px;"
            onClick=${onClose}>✕</button>
        </div>

        <!-- Progress dots -->
        <div class="teacher-progress">
          ${LESSONS.map((_, i) => html`
            <button key=${i}
              class=${'teacher-dot' + (i === step ? ' active' : '') + (i < step ? ' done' : '')}
              onClick=${() => setStep(i)}
            />
          `)}
        </div>

        <!-- Content -->
        <div class="teacher-content">
          <div class="teacher-icon">${lesson.icon}</div>
          <h2 class="teacher-title">${lesson.title}</h2>

          ${lesson.body && html`
            <div class="teacher-body">
              ${lesson.body.split('\n\n').filter(Boolean).map((para, i) => html`
                <p key=${i}>${para.trim()}</p>
              `)}
            </div>
          `}

          ${lesson.steps && html`
            <div class="teacher-steps">
              ${lesson.steps.map(s => html`
                <div key=${s.n} class="teacher-step">
                  <span class="teacher-step-num">${s.n}</span>
                  <div class="teacher-step-body">
                    <span class="teacher-step-label">${s.label}</span>
                    <span class="teacher-step-text">${s.text}</span>
                  </div>
                </div>
              `)}
            </div>
          `}

          ${lesson.tip && html`
            <div class="teacher-tip">
              <span class="teacher-tip-icon">💡</span>
              <span>${lesson.tip}</span>
            </div>
          `}
        </div>

        <!-- Navigation -->
        <div class="teacher-nav">
          <button class="btn-secondary" onClick=${prev} disabled=${isFirst}>← Back</button>
          <span class="teacher-step-counter">${step + 1} / ${LESSONS.length}</span>
          <button class="btn-primary" onClick=${next}>
            ${isLast ? 'Got it! ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  `;
}
