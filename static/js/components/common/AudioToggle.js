import { html } from '/static/js/html.js';
import { useApp } from '/static/js/state.js';

/**
 * AudioToggle — compact mute/unmute button for the top bar / header.
 * Mirrors the ThemeToggle pattern: small prop drops the text label.
 * Long-press / accessibility title shows current volume %.
 */
export function AudioToggle({ small = false }) {
  const { state, setAmbientEnabled, setAmbientVolume } = useApp();
  const enabled = state.ambientEnabled !== false;
  const vol     = state.ambientVolume ?? 0.55;
  const volPct  = Math.round(vol * 100);

  function toggle() {
    setAmbientEnabled(!enabled);
  }

  const title = enabled ? `Ambient audio on — ${volPct}% — tap to mute` : 'Ambient audio muted — tap to unmute';

  return html`
    <button
      class=${'btn-ghost audio-toggle' + (small ? ' audio-toggle--sm' : '') + (!enabled ? ' audio-toggle--muted' : '')}
      onClick=${toggle}
      title=${title}
    >
      <span class="audio-toggle-icon">${enabled ? '🔊' : '🔇'}</span>
      ${!small && html`<span class="audio-toggle-label">${enabled ? `${volPct}%` : 'Muted'}</span>`}
    </button>
  `;
}
