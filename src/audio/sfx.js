// Sound effects, synthesized (no files). They never play while the mic is
// listening, so they can't be mistaken for notes; the results-screen sounds
// all happen after an attempt ends.
import * as audio from './engine.js';
import * as mic from './mic.js';
import { getSettings } from '../core/store.js';

let Tone = null;
let bell = null;
let pluck = null;
let thump = null;

async function ensure() {
  if (bell) return true;
  await audio.load();
  Tone = await import('tone');
  const rev = new Tone.Reverb({ decay: 1.6, wet: 0.25 }).toDestination();
  bell = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 6,
    envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.6 },
    modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
    volume: -14,
  }).connect(rev);
  pluck = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.08 },
    volume: -16,
  }).connect(rev);
  thump = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -16 }).toDestination();
  return true;
}

const allowed = () => getSettings().sfx !== false && audio.running() && mic.getState() !== 'on';
const allowedDuringMic = () => getSettings().sfx !== false && audio.running() && !mic.isDetecting();

async function play(fn, { evenIfMicOpen = true } = {}) {
  if (!(evenIfMicOpen ? allowedDuringMic() : allowed())) return;
  await ensure();
  fn(Tone.now() + 0.02);
}

export const sfx = {
  /** One star lands (n = 1..3 rises in pitch). */
  star: (n) => play((t) => bell.triggerAttackRelease(['C6', 'E6', 'G6'][n - 1] || 'C7', 0.4, t)),
  /** XP counter tick. */
  tick: () => play((t) => pluck.triggerAttackRelease('C7', 0.03, t, 0.25)),
  /** Combo reached a new multiplier tier (tap mode only — silent while the mic listens). */
  comboTier: (tier) => play((t) => {
    const roots = ['C5', 'E5', 'G5', 'C6'];
    const r = roots[Math.min(tier, 3)];
    pluck.triggerAttackRelease([r, Tone.Frequency(r).transpose(7).toNote()], 0.15, t, 0.6);
  }),
  levelUp: () => play((t) => {
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => pluck.triggerAttackRelease(n, 0.25, t + i * 0.09, 0.8));
    bell.triggerAttackRelease(['C6', 'G6'], 1.2, t + 0.38);
  }),
  unlock: () => play((t) => {
    bell.triggerAttackRelease('G6', 0.3, t);
    bell.triggerAttackRelease('D7', 0.5, t + 0.12);
  }),
  fail: () => play((t) => thump.triggerAttackRelease('C2', 0.2, t)),
};
