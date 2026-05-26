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

  return { state, patch, navigate, toast, patchSetup, patchSession };
}
