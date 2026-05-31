/**
 * audio.js — Web Audio API ambient soundscape engine
 *
 * All audio is synthesised in-browser — no external files needed.
 * AudioContext is lazy-created on first call (satisfies browser autoplay policy).
 *
 * Usage:
 *   import { audioManager } from '/static/js/audio.js';
 *   audioManager.startAmbient('tomb');   // begin looping ambient for an environment
 *   audioManager.stopAmbient();          // fade out and stop
 *   audioManager.setAmbientVolume(0.6);  // 0–1
 *   audioManager.setEnabled(true);       // global mute / unmute
 */

// ── Scenario → environment tag map ───────────────────────────────────────────

export const SCENARIO_ENV = {
  'B-1': 'city',        // All That Glitters Begets Gold   — market / mine
  'B-2': 'storm',       // A Sandstorm of Malevolent Will  — desert storm
  'B-3': 'desert',      // Dessicated Delirium             — open desert
  'B-4': 'underground', // The Tainted Tower               — oasis / alchemist tower
  'B-5': 'fire',        // Forged in Flames                — smithy fire
  '1-1': 'tomb',        // Akhentepi's Legacy
  '1-2': 'city',        // Ahead of the Competition
  '1-3': 'temple',      // The Pharasmin Lottery
  '1-4': 'tomb',        // Tomb Raiders Gone Rogue
  '1-5': 'underground', // Sanctum of the Erudite Eye
  '2-1': 'city',        // Evening at the Canny Jackal
  '2-2': 'city',        // Panic in the Streets
  '2-3': 'underground', // Chains of Silver
  '2-4': 'underground', // Those Who Dwell in Darkness
  '2-5': 'tomb',        // The Gilded Mask
  '3-1': 'city',        // Muminofrah's Amusement
  '3-2': 'temple',      // Quiet, Please
  '3-3': 'city',        // Sting Operation
  '3-4': 'desert',      // Devouring Dunes
  '3-5': 'desert',      // In Search of Chisisek
  '4-1': 'desert',      // The Dragon's Garden
  '4-2': 'city',        // Pride of the Dispossessed
  '4-3': 'desert',      // Shadow of the Sphinx
  '4-4': 'temple',      // Cult of the Sightless Sphinx
  '4-5': 'underground', // A Woman of Entwined Souls
  '5-1': 'city',        // In Defense of Wati
  '5-2': 'underground', // Activating the Sekrepheres
  '5-3': 'desert',      // Lanterns of the Bone Fields
  '5-4': 'underground', // Hall of Crawling Fears
  '5-5': 'tomb',        // Tef-Naju's Bastion
  '6-1': 'sky',         // Crypt of Air
  '6-2': 'underground', // Crypt of Earth
  '6-3': 'fire',        // Crypt of Fire
  '6-4': 'underground', // Crypt of Water
  '6-5': 'sky',         // The Sky Pharaoh's Sanctum
};

// ── Noise buffer factory ──────────────────────────────────────────────────────

// Generates a loopable stereo brown-noise buffer (4 s at 44.1 kHz)
function makeBrownNoise(ctx, durationSec = 4) {
  const sr     = ctx.sampleRate;
  const frames = Math.floor(sr * durationSec);
  const buf    = ctx.createBuffer(2, frames, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < frames; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5; // scale up — brown is quiet
    }
  }
  return buf;
}

// Pink noise (Paul Kellet algorithm)
function makePinkNoise(ctx, durationSec = 4) {
  const sr     = ctx.sampleRate;
  const frames = Math.floor(sr * durationSec);
  const buf    = ctx.createBuffer(2, frames, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < frames; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

// White noise
function makeWhiteNoise(ctx, durationSec = 4) {
  const sr     = ctx.sampleRate;
  const frames = Math.floor(sr * durationSec);
  const buf    = ctx.createBuffer(2, frames, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

// ── LFO helper ────────────────────────────────────────────────────────────────

function makeLFO(ctx, freq, type = 'sine') {
  const lfo = ctx.createOscillator();
  lfo.type = type;
  lfo.frequency.value = freq;
  lfo.start();
  return lfo;
}

// ── Environment builders ──────────────────────────────────────────────────────
// Each builder returns an array of AudioNode objects that are all connected
// to `destNode`. Caller stores them to disconnect on stop.

function buildDesert(ctx, dest) {
  const nodes = [];
  const pinkBuf = makePinkNoise(ctx, 8);

  // Main wind layer — low-passed pink noise
  const wind = ctx.createBufferSource();
  wind.buffer = pinkBuf;
  wind.loop = true;
  wind.loopEnd = pinkBuf.duration;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.8;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.18;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(dest);
  wind.start();
  nodes.push(wind, windFilter, windGain);

  // Gusting LFO modulation on wind gain
  const gustLFO = makeLFO(ctx, 0.07, 'sine');
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 0.06;
  gustLFO.connect(gustDepth);
  gustDepth.connect(windGain.gain);
  nodes.push(gustLFO, gustDepth);

  // Higher-pitch sharp gust layer
  const whiteBuf = makeWhiteNoise(ctx, 4);
  const gust = ctx.createBufferSource();
  gust.buffer = whiteBuf;
  gust.loop = true;
  const gustFilter = ctx.createBiquadFilter();
  gustFilter.type = 'bandpass';
  gustFilter.frequency.value = 1200;
  gustFilter.Q.value = 0.4;
  const gustGain = ctx.createGain();
  gustGain.gain.value = 0.04;
  gust.connect(gustFilter);
  gustFilter.connect(gustGain);
  gustGain.connect(dest);
  gust.start();
  nodes.push(gust, gustFilter, gustGain);

  return nodes;
}

function buildTomb(ctx, dest) {
  const nodes = [];

  // Very low sub-bass drone — eerie silence with a heartbeat of the earth
  const drone = ctx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 42;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.07;
  drone.connect(droneGain);
  droneGain.connect(dest);
  drone.start();
  nodes.push(drone, droneGain);

  // Second harmonic — very quiet
  const drone2 = ctx.createOscillator();
  drone2.type = 'sine';
  drone2.frequency.value = 84;
  const drone2Gain = ctx.createGain();
  drone2Gain.gain.value = 0.025;
  drone2.connect(drone2Gain);
  drone2Gain.connect(dest);
  drone2.start();
  nodes.push(drone2, drone2Gain);

  // Barely-there air movement
  const brownBuf = makeBrownNoise(ctx, 8);
  const air = ctx.createBufferSource();
  air.buffer = brownBuf;
  air.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.frequency.value = 200;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.04;
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(dest);
  air.start();
  nodes.push(air, airFilter, airGain);

  // Slow breath LFO on main drone
  const breathLFO = makeLFO(ctx, 0.04, 'sine');
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 0.02;
  breathLFO.connect(breathDepth);
  breathDepth.connect(droneGain.gain);
  nodes.push(breathLFO, breathDepth);

  return nodes;
}

function buildCity(ctx, dest) {
  const nodes = [];
  const pinkBuf = makePinkNoise(ctx, 6);

  // Crowd murmur — bandpass-filtered noise
  const crowd = ctx.createBufferSource();
  crowd.buffer = pinkBuf;
  crowd.loop = true;
  const crowdFilter = ctx.createBiquadFilter();
  crowdFilter.type = 'bandpass';
  crowdFilter.frequency.value = 600;
  crowdFilter.Q.value = 0.6;
  const crowdGain = ctx.createGain();
  crowdGain.gain.value = 0.09;
  crowd.connect(crowdFilter);
  crowdFilter.connect(crowdGain);
  crowdGain.connect(dest);
  crowd.start();
  nodes.push(crowd, crowdFilter, crowdGain);

  // Low street rumble
  const rumble = ctx.createBufferSource();
  rumble.buffer = makeBrownNoise(ctx, 5);
  rumble.loop = true;
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 300;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.06;
  rumble.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(dest);
  rumble.start();
  nodes.push(rumble, rumbleFilter, rumbleGain);

  // Activity variation LFO
  const actLFO = makeLFO(ctx, 0.12, 'sine');
  const actDepth = ctx.createGain();
  actDepth.gain.value = 0.025;
  actLFO.connect(actDepth);
  actDepth.connect(crowdGain.gain);
  nodes.push(actLFO, actDepth);

  return nodes;
}

function buildStorm(ctx, dest) {
  const nodes = [];

  // Heavy rain — white noise through lowpass
  const rainBuf = makeWhiteNoise(ctx, 4);
  const rain = ctx.createBufferSource();
  rain.buffer = rainBuf;
  rain.loop = true;
  const rainFilter = ctx.createBiquadFilter();
  rainFilter.type = 'lowpass';
  rainFilter.frequency.value = 2800;
  const rainGain = ctx.createGain();
  rainGain.gain.value = 0.14;
  rain.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(dest);
  rain.start();
  nodes.push(rain, rainFilter, rainGain);

  // Storm wind — brown noise
  const windBuf = makeBrownNoise(ctx, 6);
  const wind = ctx.createBufferSource();
  wind.buffer = windBuf;
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 500;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.16;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(dest);
  wind.start();
  nodes.push(wind, windFilter, windGain);

  // Gusting LFO
  const gustLFO = makeLFO(ctx, 0.15, 'sine');
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 0.08;
  gustLFO.connect(gustDepth);
  gustDepth.connect(windGain.gain);
  nodes.push(gustLFO, gustDepth);

  return nodes;
}

function buildFire(ctx, dest) {
  const nodes = [];
  const pinkBuf = makePinkNoise(ctx, 5);

  // Base fire roar — bandpass pink noise
  const fire = ctx.createBufferSource();
  fire.buffer = pinkBuf;
  fire.loop = true;
  const fireFilter = ctx.createBiquadFilter();
  fireFilter.type = 'bandpass';
  fireFilter.frequency.value = 280;
  fireFilter.Q.value = 0.7;
  const fireGain = ctx.createGain();
  fireGain.gain.value = 0.14;
  fire.connect(fireFilter);
  fireFilter.connect(fireGain);
  fireGain.connect(dest);
  fire.start();
  nodes.push(fire, fireFilter, fireGain);

  // Crackling — faster irregular modulation
  const crackLFO = makeLFO(ctx, 3.2, 'sawtooth');
  const crackDepth = ctx.createGain();
  crackDepth.gain.value = 0.05;
  crackLFO.connect(crackDepth);
  crackDepth.connect(fireGain.gain);
  nodes.push(crackLFO, crackDepth);

  // Higher crackle layer
  const hissBuf = makeWhiteNoise(ctx, 3);
  const hiss = ctx.createBufferSource();
  hiss.buffer = hissBuf;
  hiss.loop = true;
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'bandpass';
  hissFilter.frequency.value = 1800;
  hissFilter.Q.value = 1.2;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.03;
  hiss.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissGain.connect(dest);
  hiss.start();
  nodes.push(hiss, hissFilter, hissGain);

  return nodes;
}

function buildUnderground(ctx, dest) {
  const nodes = [];

  // Deep cave resonance — very low sine
  const rumble = ctx.createOscillator();
  rumble.type = 'sine';
  rumble.frequency.value = 55;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.06;
  rumble.connect(rumbleGain);
  rumbleGain.connect(dest);
  rumble.start();
  nodes.push(rumble, rumbleGain);

  // Cave air — filtered brown noise
  const brownBuf = makeBrownNoise(ctx, 7);
  const air = ctx.createBufferSource();
  air.buffer = brownBuf;
  air.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.frequency.value = 350;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.07;
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(dest);
  air.start();
  nodes.push(air, airFilter, airGain);

  // Slow breathing pulse on rumble
  const breathLFO = makeLFO(ctx, 0.06, 'sine');
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 0.03;
  breathLFO.connect(breathDepth);
  breathDepth.connect(rumbleGain.gain);
  nodes.push(breathLFO, breathDepth);

  return nodes;
}

function buildTemple(ctx, dest) {
  const nodes = [];

  // Tonic drone — 110 Hz (A2)
  const base = ctx.createOscillator();
  base.type = 'sine';
  base.frequency.value = 110;
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.055;
  base.connect(baseGain);
  baseGain.connect(dest);
  base.start();
  nodes.push(base, baseGain);

  // 3rd harmonic (E3 ≈ 165 Hz)
  const third = ctx.createOscillator();
  third.type = 'sine';
  third.frequency.value = 165;
  const thirdGain = ctx.createGain();
  thirdGain.gain.value = 0.025;
  third.connect(thirdGain);
  thirdGain.connect(dest);
  third.start();
  nodes.push(third, thirdGain);

  // 5th harmonic (B3 ≈ 247 Hz) — very quiet
  const fifth = ctx.createOscillator();
  fifth.type = 'sine';
  fifth.frequency.value = 247;
  const fifthGain = ctx.createGain();
  fifthGain.gain.value = 0.010;
  fifth.connect(fifthGain);
  fifthGain.connect(dest);
  fifth.start();
  nodes.push(fifth, fifthGain);

  // Room air — very faint pink noise
  const pinkBuf = makePinkNoise(ctx, 5);
  const room = ctx.createBufferSource();
  room.buffer = pinkBuf;
  room.loop = true;
  const roomFilter = ctx.createBiquadFilter();
  roomFilter.type = 'lowpass';
  roomFilter.frequency.value = 600;
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0.025;
  room.connect(roomFilter);
  roomFilter.connect(roomGain);
  roomGain.connect(dest);
  room.start();
  nodes.push(room, roomFilter, roomGain);

  // Very slow swell LFO on tonic
  const swellLFO = makeLFO(ctx, 0.025, 'sine');
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 0.018;
  swellLFO.connect(swellDepth);
  swellDepth.connect(baseGain.gain);
  nodes.push(swellLFO, swellDepth);

  return nodes;
}

function buildSky(ctx, dest) {
  const nodes = [];
  const whiteBuf = makeWhiteNoise(ctx, 5);

  // High-altitude wind — highpass white noise
  const wind = ctx.createBufferSource();
  wind.buffer = whiteBuf;
  wind.loop = true;
  const hiFilter = ctx.createBiquadFilter();
  hiFilter.type = 'highpass';
  hiFilter.frequency.value = 1800;
  const loFilter = ctx.createBiquadFilter();
  loFilter.type = 'lowpass';
  loFilter.frequency.value = 6000;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.10;
  wind.connect(hiFilter);
  hiFilter.connect(loFilter);
  loFilter.connect(windGain);
  windGain.connect(dest);
  wind.start();
  nodes.push(wind, hiFilter, loFilter, windGain);

  // Spaciousness — very high sine tone (almost inaudible, felt more than heard)
  const tone = ctx.createOscillator();
  tone.type = 'sine';
  tone.frequency.value = 528;
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.012;
  tone.connect(toneGain);
  toneGain.connect(dest);
  tone.start();
  nodes.push(tone, toneGain);

  // Gusting LFO
  const gustLFO = makeLFO(ctx, 0.10, 'sine');
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 0.04;
  gustLFO.connect(gustDepth);
  gustDepth.connect(windGain.gain);
  nodes.push(gustLFO, gustDepth);

  return nodes;
}

const ENV_BUILDERS = {
  desert:      buildDesert,
  tomb:        buildTomb,
  city:        buildCity,
  storm:       buildStorm,
  fire:        buildFire,
  underground: buildUnderground,
  temple:      buildTemple,
  sky:         buildSky,
};

// ── AudioManager ──────────────────────────────────────────────────────────────

class AudioManager {
  constructor() {
    this._ctx         = null;
    this._masterGain  = null;
    this._ambientGain = null;
    this._activeNodes = [];     // currently running ambient nodes
    this._activeEnv   = null;
    this._enabled     = true;
    this._ambientVol  = 0.55;   // default ambient volume
    this._fadeTimer   = null;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _init() {
    if (this._ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this._ctx = new AC();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._enabled ? 1 : 0;
      this._masterGain.connect(this._ctx.destination);
      this._ambientGain = this._ctx.createGain();
      this._ambientGain.gain.value = this._ambientVol;
      this._ambientGain.connect(this._masterGain);
    } catch (e) {
      console.warn('[audio] Web Audio API unavailable:', e);
    }
  }

  _resume() {
    if (this._ctx?.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
  }

  _stopNodes() {
    for (const node of this._activeNodes) {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch { /* already stopped */ }
    }
    this._activeNodes = [];
    this._activeEnv = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Start ambient for the given environment tag. Crossfades if one is already running. */
  startAmbient(envTag) {
    if (!envTag) return;
    if (envTag === this._activeEnv) return; // already playing this env

    this._init();
    if (!this._ctx || !this._enabled) return;
    this._resume();

    const builder = ENV_BUILDERS[envTag];
    if (!builder) return;

    const now = this._ctx.currentTime;
    const FADE = 2.5; // seconds

    // Fade out existing ambient
    if (this._activeNodes.length) {
      this._ambientGain.gain.setValueAtTime(this._ambientVol, now);
      this._ambientGain.gain.linearRampToValueAtTime(0, now + FADE);
      const oldNodes = this._activeNodes;
      clearTimeout(this._fadeTimer);
      this._fadeTimer = setTimeout(() => {
        for (const n of oldNodes) {
          try { if (typeof n.stop === 'function') n.stop(); n.disconnect(); } catch {}
        }
      }, (FADE + 0.2) * 1000);
    }

    // New destination gain starts at 0, fades in
    const newDest = this._ctx.createGain();
    newDest.gain.setValueAtTime(0, now);
    newDest.gain.linearRampToValueAtTime(1, now + FADE);
    newDest.connect(this._ambientGain);

    const nodes = builder(this._ctx, newDest);
    this._activeNodes = [...nodes, newDest];
    this._activeEnv = envTag;

    // Restore ambient gain after fade
    this._ambientGain.gain.cancelScheduledValues(now + FADE);
    this._ambientGain.gain.setValueAtTime(this._ambientVol, now + FADE);
  }

  /** Fade out and stop all ambient audio. */
  stopAmbient(fadeSec = 2) {
    if (!this._ctx || !this._activeNodes.length) return;
    const now = this._ctx.currentTime;
    this._ambientGain.gain.setValueAtTime(this._ambientGain.gain.value, now);
    this._ambientGain.gain.linearRampToValueAtTime(0, now + fadeSec);
    const nodes = this._activeNodes;
    clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      for (const n of nodes) {
        try { if (typeof n.stop === 'function') n.stop(); n.disconnect(); } catch {}
      }
      if (this._ambientGain) {
        this._ambientGain.gain.cancelScheduledValues(0);
        this._ambientGain.gain.value = this._ambientVol;
      }
    }, (fadeSec + 0.2) * 1000);
    this._activeNodes = [];
    this._activeEnv = null;
  }

  /** 0–1. Takes effect immediately and is persisted externally by the caller. */
  setAmbientVolume(v) {
    this._ambientVol = Math.max(0, Math.min(1, v));
    if (this._ambientGain) {
      this._ambientGain.gain.value = this._enabled ? this._ambientVol : 0;
    }
  }

  /** Enable / disable all audio (master mute). */
  setEnabled(on) {
    this._enabled = on;
    if (this._masterGain) {
      this._masterGain.gain.value = on ? 1 : 0;
    }
    if (on && this._ctx) this._resume();
  }

  get enabled()     { return this._enabled; }
  get ambientVolume() { return this._ambientVol; }
  get activeEnv()   { return this._activeEnv; }
}

export const audioManager = new AudioManager();
