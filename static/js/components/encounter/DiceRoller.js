import { html } from '/static/js/html.js';
import { useState, useRef, useCallback } from '/static/js/vendor/hooks.module.js';

const DICE = [4, 6, 8, 10, 12, 20];

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// Tumble a single die: rapidly cycles random values, then snaps to finalValue
// Returns a cleanup function
function tumbleDie(sides, finalValue, durationMs, onTick, onSettle) {
  const tickInterval = 60; // ms between random flashes
  const intervalId = setInterval(() => {
    onTick(rollDie(sides));
  }, tickInterval);
  const timeoutId = setTimeout(() => {
    clearInterval(intervalId);
    onSettle(finalValue);
  }, durationMs);
  return () => { clearInterval(intervalId); clearTimeout(timeoutId); };
}

export function DiceRoller({ onResult }) {
  const [pool, setPool]         = useState({}); // { 6: 2, 8: 1, ... }
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling]   = useState(false);
  const [result, setResult]     = useState(null); // { total, rolls, modifier }
  // During animation: array of { sides, displayValue, settled }
  const [animRolls, setAnimRolls] = useState(null);
  const cleanupRef = useRef([]);

  function addDie(sides) {
    setPool(p => ({ ...p, [sides]: (p[sides] || 0) + 1 }));
    setResult(null);
  }

  function removeDie(sides) {
    setPool(p => {
      const next = { ...p };
      if ((next[sides] || 0) > 1) next[sides]--;
      else delete next[sides];
      return next;
    });
    setResult(null);
  }

  function clearPool() {
    setPool({});
    setModifier(0);
    setResult(null);
    setAnimRolls(null);
  }

  function roll() {
    if (rolling) return;

    // Build the final roll values first
    const rolls = [];
    for (const [sides, count] of Object.entries(pool)) {
      for (let i = 0; i < count; i++) {
        rolls.push({ sides: Number(sides), value: rollDie(Number(sides)) });
      }
    }
    const diceTotal = rolls.reduce((s, r) => s + r.value, 0);
    const total = diceTotal + modifier;

    // Cancel any lingering animations
    cleanupRef.current.forEach(fn => fn());
    cleanupRef.current = [];

    // Initialize animated display — all dice showing a random value
    const initial = rolls.map(r => ({ sides: r.sides, display: rollDie(r.sides), settled: false }));
    setAnimRolls(initial);
    setResult(null);
    setRolling(true);

    // Stagger each die settling: die i settles after (400 + i * 150)ms
    rolls.forEach((r, i) => {
      const duration = 400 + i * 150;
      const cleanup = tumbleDie(
        r.sides,
        r.value,
        duration,
        (randVal) => {
          setAnimRolls(prev => {
            if (!prev) return prev;
            const next = [...prev];
            next[i] = { ...next[i], display: randVal };
            return next;
          });
        },
        (finalVal) => {
          setAnimRolls(prev => {
            if (!prev) return prev;
            const next = [...prev];
            next[i] = { ...next[i], display: finalVal, settled: true };
            return next;
          });
        }
      );
      cleanupRef.current.push(cleanup);
    });

    // After all dice settle, show the result with a counting-up total
    const totalDelay = 400 + (rolls.length - 1) * 150 + 200;
    const countUpDuration = Math.min(600, 80 * rolls.length);
    const steps = 12;
    const stepDelay = countUpDuration / steps;

    const countTimeout = setTimeout(() => {
      setRolling(false);
      // Count up the total
      let step = 0;
      const countId = setInterval(() => {
        step++;
        const displayed = step >= steps
          ? total
          : Math.round((step / steps) * total);
        if (step >= steps) {
          clearInterval(countId);
          setResult({ total, rolls, modifier });
          setAnimRolls(null);
          if (onResult) onResult(total);
        } else {
          // Show interim count via a temp result
          setResult({ total: displayed, rolls: [], modifier: 0, counting: true });
        }
      }, stepDelay);
      cleanupRef.current.push(() => clearInterval(countId));
    }, totalDelay);

    cleanupRef.current.push(() => clearTimeout(countTimeout));
  }

  const poolEntries = Object.entries(pool).sort((a, b) => Number(a[0]) - Number(b[0]));
  const hasDice = poolEntries.length > 0;
  const poolSummary = [
    ...poolEntries.map(([s, c]) => `${c}d${s}`),
    modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : null,
  ].filter(Boolean).join(' + ');

  return html`
    <div class="dice-section">
      <div class="dice-label">Dice Roller</div>

      <div class="dice-row">
        ${DICE.map(s => {
          const count = pool[s] || 0;
          return html`
            <button key=${s} class="die-btn" onClick=${() => !rolling && addDie(s)}
              onContextMenu=${(e) => { e.preventDefault(); !rolling && removeDie(s); }}>
              ${count > 0 && html`<span class="die-count">${count}</span>`}
              <span>⬡</span>
              <span class="die-label">d${s}</span>
            </button>
          `;
        })}

        <div class="modifier-row">
          <button onClick=${() => !rolling && setModifier(m => m - 1)}>−</button>
          <div class="modifier-value">${modifier >= 0 ? `+${modifier}` : modifier}</div>
          <button onClick=${() => !rolling && setModifier(m => m + 1)}>+</button>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:10px;">
        <div class="dice-pool-summary">
          ${hasDice
            ? html`Pool: <span>${poolSummary}</span>`
            : html`Tap dice to build a pool. Right-tap to remove.`}
        </div>
        ${hasDice && !rolling && html`
          <button class="btn-ghost btn-sm" onClick=${clearPool}
            style="flex-shrink:0;">Clear</button>
        `}
      </div>

      ${hasDice && html`
        <button class=${'btn-primary' + (rolling ? ' disabled' : '')}
          onClick=${roll} disabled=${rolling}>
          ${rolling ? 'Rolling…' : `Roll ${poolSummary}`}
        </button>
      `}

      <!-- Animated individual dice during roll -->
      ${animRolls && html`
        <div class="dice-result dice-result--rolling">
          <div class="dice-tumble-row">
            ${animRolls.map((r, i) => html`
              <div key=${i} class=${'tumble-die' + (r.settled ? ' settled' : ' tumbling')}
                style="--die-delay:${i * 0.15}s">
                <span class="tumble-face">${r.display}</span>
                <span class="tumble-sides">d${r.sides}</span>
              </div>
            `)}
            ${modifier !== 0 && html`
              <div class="tumble-die settled" style="opacity:0.6;">
                <span class="tumble-face">${modifier > 0 ? '+' : ''}${modifier}</span>
                <span class="tumble-sides">mod</span>
              </div>
            `}
          </div>
        </div>
      `}

      <!-- Final result -->
      ${result && !animRolls && html`
        <div class=${'dice-result' + (result.counting ? ' dice-result--counting' : '')}>
          <div class="dice-result-total">${result.total}</div>
          ${!result.counting && html`
            <div class="dice-result-breakdown">
              ${result.rolls.map((r, i) => html`
                <span key=${i} class="die-val" title="d${r.sides}">${r.value}</span>
              `)}
              ${result.modifier !== 0 && html`
                <span class="die-val">${result.modifier > 0 ? '+' : ''}${result.modifier}</span>
              `}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}
