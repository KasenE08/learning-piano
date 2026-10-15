// Microphone input: permission, capture (AudioWorklet), analysis and note events.
// iOS notes:
//  - echoCancellation / noiseSuppression / autoGainControl are switched off;
//    they distort piano tone and confuse pitch detection.
//  - The audio session switches to 'play-and-record' while the mic is open so
//    the metronome still plays through the speaker.
//  - iOS stops the mic when the app is backgrounded; the track ends and we
//    report 'off' so the next tap can re-open it.
import * as audio from './engine.js';
import { createAnalyzer, FRAME_SIZE } from './analysis.js';
import { createNoteDetector } from './detector.js';
import { createSpectrum, newNote, PROBE_SIZE } from './salience.js';

let state = 'off'; // off | starting | on | denied | unsupported | error
let stream = null;
let nodes = [];
let ring = null;
let analyzer = null;
let detector = null;
let detecting = false;
let detectorOpts = {};
let workletLoaded = false;
const noteListeners = new Set();
const onsetListeners = new Set();
// The last ~0.7 s of audio, for checking a specific note at an onset.
const HIST = 32768;
let hist = null;
let histEnd = 0; // audio-clock time just after the newest sample
let probeSpec = null;
const frameListeners = new Set();
const stateListeners = new Set();

const setState = (s) => { state = s; stateListeners.forEach((fn) => fn(s)); };

export const getState = () => state;
export const isDetecting = () => state === 'on' && detecting;
export const onState = (fn) => { stateListeners.add(fn); return () => stateListeners.delete(fn); };
/** fn({ midi, time (audio clock s), perf (performance.now ms), how }) */
export const onNote = (fn) => { noteListeners.add(fn); return () => noteListeners.delete(fn); };
/**
 * Every attack, including repeats the detector dropped as "still ringing" (dropped: true),
 * with hears(midi): did that note just start here? For scoring a melody under a left hand.
 */
export const onOnset = (fn) => { onsetListeners.add(fn); return () => onsetListeners.delete(fn); };
/** fn(features, time) every hop — for meters and calibration. */
export const onFrame = (fn) => { frameListeners.add(fn); return () => frameListeners.delete(fn); };

/** Detector settings from calibration: { noiseDb, low, high }. */
export function configure(opts) {
  detectorOpts = { ...detectorOpts, ...opts };
  if (analyzer) detector = createNoteDetector(analyzer.sampleRate, { ...detectorOpts, reportDropped: true });
}

/** Turn note detection on/off without closing the mic (e.g. off during the Listen demo). */
export function setDetecting(on) {
  detecting = on;
  detector?.reset();
}

/** Must be called from a tap. Resolves to the final state. */
export async function start() {
  if (state === 'on') return state;
  if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return state; }
  setState('starting');
  try {
    await audio.unlock();
    audio.setSession('play-and-record');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (e) {
    audio.setSession('playback');
    setState(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'error');
    return state;
  }
  try {
    const ctx = audio.context();
    // Load our worklet directly (Tone caches a single worklet module per context).
    if (!workletLoaded) {
      await ctx.rawContext.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url).href);
      workletLoaded = true;
    }
    const src = ctx.createMediaStreamSource(stream);
    const tap = ctx.createAudioWorkletNode('mic-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(tap);
    tap.connect(mute);
    mute.connect(ctx.rawContext.destination);
    nodes = [src, tap, mute];

    const sr = ctx.sampleRate;
    analyzer = createAnalyzer(sr);
    detector = createNoteDetector(sr, { ...detectorOpts, reportDropped: true });
    ring = new Float32Array(FRAME_SIZE);
    hist = new Float32Array(HIST);
    probeSpec = createSpectrum(sr);
    tap.port.onmessage = ({ data }) => {
      const { t, samples } = data;
      ring.copyWithin(0, samples.length);
      ring.set(samples, FRAME_SIZE - samples.length);
      hist.copyWithin(0, samples.length);
      hist.set(samples, HIST - samples.length);
      histEnd = t;
      const f = analyzer.analyze(ring);
      frameListeners.forEach((fn) => fn(f, t, ring));
      if (!detecting) return;
      for (const ev of detector.push(f, t)) {
        const e = { ...ev, perf: audio.contextToPerf(ev.time) };
        if (!e.dropped) noteListeners.forEach((fn) => fn(e));
        if (onsetListeners.size) {
          let spectra = null;
          e.hears = (midi) => {
            if (!spectra || histEnd < ev.time + ATTACK_MS / 1000) spectra = onsetSpectra(ev.time, sr);
            return spectra ? newNote(spectra[0], spectra[1], probeSpec.binHz, midi) : false;
          };
          onsetListeners.forEach((fn) => fn(e));
        }
      }
    };
    stream.getAudioTracks().forEach((tr) => tr.addEventListener('ended', () => stop()));
    setState('on');
  } catch (e) {
    console.error(e);
    stop();
    setState('error');
  }
  return state;
}

/**
 * Did `midi` start near `perfMs` (performance.now clock)? Tries onsets within
 * ±spanMs in 35 ms steps, nearest first; returns the onset time found or null.
 * Needs ATTACK_MS of audio after the latest onset tried.
 */
export function noteStartedNear(midi, perfMs, spanMs = 100) {
  if (state !== 'on' || !hist) return null;
  const sr = analyzer.sampleRate;
  const steps = Math.floor(spanMs / 35);
  const order = [0];
  for (let k = 1; k <= steps; k++) order.push(-k, k);
  for (const k of order) {
    const at = perfMs + k * 35;
    const sp = onsetSpectra(audio.perfToContext(at), sr);
    if (sp && newNote(sp[0], sp[1], probeSpec.binHz, midi)) return at;
  }
  return null;
}

/**
 * Spectra just before an onset and ~130 ms into it (or the newest audio if that
 * hasn't arrived yet — so callers wait ATTACK_MS after the onset before asking).
 */
export const ATTACK_MS = 130;
function onsetSpectra(onset, sr) {
  const idx = (time) => HIST - Math.round((histEnd - time) * sr);
  const beforeEnd = idx(onset - 0.01);
  const afterEnd = idx(Math.min(histEnd, onset + ATTACK_MS / 1000));
  if (beforeEnd - PROBE_SIZE < 0) return null;
  return [probeSpec.of(hist, beforeEnd - PROBE_SIZE), probeSpec.of(hist, afterEnd - PROBE_SIZE)];
}

export function stop() {
  nodes.forEach((n) => { try { n.disconnect(); } catch { /* already */ } });
  nodes = [];
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  detecting = false;
  audio.setSession('playback');
  if (state === 'on' || state === 'starting') setState('off');
}
