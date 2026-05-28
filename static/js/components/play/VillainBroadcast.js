import { html } from '/static/js/html.js';

/**
 * VillainBroadcast — full-screen alert shown when the villain is encountered.
 * Lists all other open locations and their closing conditions so players
 * can coordinate temp-close attempts.
 *
 * Props:
 *   villainLocation   – the location object where the villain was found
 *   openLocations     – array of all open session locations (excluding the villain's)
 *   characters        – all session characters (for showing who is where)
 *   onDismiss         – called when user taps "I understand"
 */
export function VillainBroadcast({ villainLocation, openLocations, characters, onDismiss }) {
  // Locations that need to be closed to trap the villain (everything open except where villain is)
  const escapePaths = openLocations.filter(l => l.id !== villainLocation?.id);

  return html`
    <div class="villain-broadcast-backdrop">
      <div class="villain-broadcast-panel">

        <div class="villain-broadcast-alert">
          <span class="villain-broadcast-icon">⚡</span>
          <div class="villain-broadcast-headline">
            Villain Found!
          </div>
          <div class="villain-broadcast-sub">
            ${villainLocation
              ? html`The villain is at <strong>${villainLocation.name}</strong>.`
              : html`The villain has been revealed!`
            }
          </div>
        </div>

        ${escapePaths.length > 0
          ? html`
            <div class="villain-broadcast-body">
              <div class="villain-broadcast-instruction">
                All other players — attempt to <strong>temporarily close</strong> your location
                to prevent the villain from escaping!
              </div>
              <div class="villain-escape-list">
                ${escapePaths.map(loc => {
                  const charsHere = (loc.characters_here || [])
                    .map(cid => characters?.find(c => c.id === cid)?.name)
                    .filter(Boolean);
                  return html`
                    <div key=${loc.id} class="villain-escape-row">
                      <div class="villain-escape-loc-header">
                        <span class="villain-escape-loc-name">${loc.name}</span>
                        ${charsHere.length > 0 && html`
                          <span class="villain-escape-chars">${charsHere.join(', ')}</span>
                        `}
                      </div>
                      ${loc.to_close
                        ? html`
                          <div class="villain-escape-condition">
                            <span class="villain-escape-label">To close:</span>
                            <span class="villain-escape-text">${loc.to_close}</span>
                          </div>
                        `
                        : html`
                          <div class="villain-escape-condition">
                            <span class="villain-escape-text villain-escape-dim">No special condition</span>
                          </div>
                        `
                      }
                    </div>
                  `;
                })}
              </div>
            </div>
          `
          : html`
            <div class="villain-broadcast-body">
              <div class="villain-broadcast-instruction villain-broadcast-win">
                No other locations are open — the villain is trapped!
                Defeat the villain now to win the scenario.
              </div>
            </div>
          `
        }

        <div class="villain-broadcast-footer">
          <button class="btn-primary villain-broadcast-btn" onClick=${onDismiss}>
            I understand — continue
          </button>
        </div>
      </div>
    </div>
  `;
}
