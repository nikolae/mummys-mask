import { createContext } from '/static/js/vendor/preact.module.js';
import { useContext, useState, useCallback } from '/static/js/vendor/hooks.module.js';

// ── App-level state ──────────────────────────────────────────────────────────

export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

// Initial state shape
export function makeInitialState() {
  return {
    // Routing
    view: 'campaigns',          // 'campaigns' | 'setup' | 'play'
    campaignId: null,
    sessionId: null,

    // Loaded data (from API)
    campaigns: null,            // array or null (loading)
    campaign: null,             // current campaign object
    session: null,              // current session state
    adventures: null,           // array of adventure summaries

    // Setup working state
    setup: {
      scenarioId: null,
      characterTypes: [],       // [{id, name, type, hand_size}]
      locationNames: [],        // string[]
    },

    // Guided (new player) mode — persisted in localStorage
    guidedMode: typeof localStorage !== 'undefined' && localStorage.getItem('mm_guided') === 'true',

    // UI theme — 'dark' | 'light' | 'high-contrast', persisted in localStorage
    theme: typeof localStorage !== 'undefined' ? (localStorage.getItem('mm_theme') || 'dark') : 'dark',

    // Ambient audio — persisted in localStorage
    ambientEnabled: typeof localStorage !== 'undefined' ? (localStorage.getItem('mm_ambient_enabled') !== 'false') : true,
    ambientVolume:  typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('mm_ambient_volume') || '0.55') : 0.55,

    // Sound effects — persisted in localStorage
    sfxEnabled: typeof localStorage !== 'undefined' ? (localStorage.getItem('mm_sfx_enabled') !== 'false') : true,
    sfxVolume:  typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('mm_sfx_volume') || '0.6') : 0.6,

    // Owned products (loaded from server on startup)
    ownedProducts: ['base', 'class_deck'],

    // Toast queue
    toasts: [],
  };
}

let _toastId = 0;

export function useAppState() {
  const [state, setState] = useState(makeInitialState);

  const patch = useCallback((updates) => {
    setState(s => ({ ...s, ...updates }));
  }, []);

  const navigate = useCallback((view, extra = {}) => {
    setState(s => ({ ...s, view, ...extra }));
  }, []);

  const toast = useCallback((message, type = 'info') => {
    const id = ++_toastId;
    setState(s => ({ ...s, toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      setState(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }));
    }, 3000);
  }, []);

  const patchSetup = useCallback((updates) => {
    setState(s => ({ ...s, setup: { ...s.setup, ...updates } }));
  }, []);

  const patchSession = useCallback((updates) => {
    setState(s => ({ ...s, session: s.session ? { ...s.session, ...updates } : s.session }));
  }, []);

  const toggleGuided = useCallback(() => {
    setState(s => {
      const next = !s.guidedMode;
      localStorage.setItem('mm_guided', String(next));
      return { ...s, guidedMode: next };
    });
  }, []);

  const setTheme = useCallback((theme) => {
    localStorage.setItem('mm_theme', theme);
    if (theme === 'dark') {
      document.body.removeAttribute('data-theme');
    } else {
      document.body.setAttribute('data-theme', theme);
    }
    setState(s => ({ ...s, theme }));
  }, []);

  const setAmbientEnabled = useCallback((on) => {
    localStorage.setItem('mm_ambient_enabled', String(on));
    setState(s => ({ ...s, ambientEnabled: on }));
  }, []);

  const setAmbientVolume = useCallback((v) => {
    const val = Math.max(0, Math.min(1, v));
    localStorage.setItem('mm_ambient_volume', String(val));
    setState(s => ({ ...s, ambientVolume: val }));
  }, []);

  const setSfxEnabled = useCallback((on) => {
    localStorage.setItem('mm_sfx_enabled', String(on));
    setState(s => ({ ...s, sfxEnabled: on }));
  }, []);

  const setSfxVolume = useCallback((v) => {
    const val = Math.max(0, Math.min(1, v));
    localStorage.setItem('mm_sfx_volume', String(val));
    setState(s => ({ ...s, sfxVolume: val }));
  }, []);

  return { state, patch, navigate, toast, patchSetup, patchSession, toggleGuided, setTheme, setAmbientEnabled, setAmbientVolume, setSfxEnabled, setSfxVolume };
}
