// Audio: one shared context (Tone.js), the sampled piano and the metronome.
// iOS rules handled here:
//  - The context may only start inside a user tap: call unlock() from a tap handler.
//  - The ring/silent switch mutes Web Audio unless the audio session is 'playback'.
//  - After backgrounding, the context is suspended; resume() on return (may need a tap).
import { nameOf } from '../core/music.js';

let Tone = null;
let piano = null;
let click = null;
let loading = null;

const SAMPLE_NOTES = [];
for (let o = 1; o <= 8; o++) {
  for (const [n, file] of [['C', 'C'], ['D#', 'Ds'], ['F#', 'Fs'], ['A', 'A']]) {
    const midi = (o + 1) * 12 + { C: 0, 'D#': 3, 'F#': 6, A: 9 }[n];
    if (midi >= 33 && midi <= 108) SAMPLE_NOTES.push([`${n}${o}`, `${file}${o}.mp3`]);
  }
}

/** Load Tone.js and the piano samples. Safe to call before any user gesture. */
export function load() {
  if (loading) return loading;
  loading = (async () => {
    Tone = await import('tone');
    piano = new Tone.Sampler({
      urls: Object.fromEntries(SAMPLE_NOTES),
      baseUrl: `${import.meta.env.BASE_URL}samples/piano/`,
      release: 1.2,
    }).toDestination();
    // Metronome click: a short burst of high-passed noise. It is clearly audible
    // but has almost no energy in the piano band, so the mic ignores it.
    const hp = new Tone.Filter(4500, 'highpass').toDestination();
    click = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.0005, decay: 0.03, sustain: 0, release: 0.01 },
      volume: -4,
    }).connect(hp);
    await Tone.loaded();
  })();
  return loading;
}

export const isLoaded = () => !!piano?.loaded;

let sessionType = 'playback';
/** 'playback' (ignores the silent switch) or 'play-and-record' (while the mic is open). */
export function setSession(type) {
  sessionType = type;
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* unsupported */ }
}

/** Must run inside a tap/click handler. */
export async function unlock() {
  await load();
  setSession(sessionType);
  await Tone.start();
}

export async function resume() {
  if (!Tone) return true;
  const ctx = Tone.getContext().rawContext;
  if (ctx.state !== 'running') {
    try { await ctx.resume(); } catch { /* needs a gesture */ }
  }
  return ctx.state === 'running';
}

export const running = () => !!Tone && Tone.getContext().rawContext.state === 'running';
export const now = () => Tone.now();

/** Converts an audio-clock time (s) to the performance.now() clock (ms) and adds output latency. */
export function audioToPerf(t) {
  const ctx = Tone.getContext().rawContext;
  const ts = ctx.getOutputTimestamp?.();
  const lat = ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000;
  if (ts && ts.performanceTime) return ts.performanceTime + (t - ts.contextTime) * 1000 + lat;
  return performance.now() + (t - ctx.currentTime) * 1000 + lat;
}

export function playNote(midi, durSec = 0.6, time, velocity = 0.8) {
  if (!piano?.loaded) return;
  piano.triggerAttackRelease(nameOf(midi), durSec, time, velocity);
}

export function playClick(time, accent = false) {
  click?.triggerAttackRelease(0.03, time, accent ? 1 : 0.55);
}

export const context = () => Tone.getContext();

/** Audio-clock time (s) → performance.now() (ms), for input events (no output latency). */
/** Inverse of contextToPerf: a performance.now() time on the audio clock. */
export function perfToContext(ms) {
  const ctx = Tone.getContext().rawContext;
  const ts = ctx.getOutputTimestamp?.();
  if (ts && ts.performanceTime) return ts.contextTime + (ms - ts.performanceTime) / 1000;
  return ctx.currentTime + (ms - performance.now()) / 1000;
}

export function contextToPerf(t) {
  const ctx = Tone.getContext().rawContext;
  const ts = ctx.getOutputTimestamp?.();
  if (ts && ts.performanceTime) return ts.performanceTime + (t - ts.contextTime) * 1000;
  return performance.now() + (t - ctx.currentTime) * 1000;
}

/** Schedules callbacks on the transport; returns the audio time at which beat 0 sounds. */
export function startTransport(events, leadSec = 0.15) {
  const tr = Tone.getTransport();
  tr.stop();
  tr.cancel(0);
  tr.position = 0;
  for (const e of events) tr.schedule((time) => e.fn(time), e.at);
  const startAt = Tone.now() + leadSec;
  tr.start(startAt);
  return startAt;
}

export function stopAll() {
  if (!Tone) return;
  const tr = Tone.getTransport();
  tr.stop();
  tr.cancel(0);
  piano?.releaseAll();
}

// Resume audio when the app comes back to the foreground.
document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
window.addEventListener('pageshow', () => resume());
