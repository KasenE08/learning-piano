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
const frameListeners = new Set();
const stateListeners = new Set();

const setState = (s) => { state = s; stateListeners.forEach((fn) => fn(s)); };

export const getState = () => state;
export const onState = (fn) => { stateListeners.add(fn); return () => stateListeners.delete(fn); };
/** fn({ midi, time (audio clock s), perf (performance.now ms), how }) */
export const onNote = (fn) => { noteListeners.add(fn); return () => noteListeners.delete(fn); };
/** fn(features, time) every hop — for meters and calibration. */
export const onFrame = (fn) => { frameListeners.add(fn); return () => frameListeners.delete(fn); };

/** Detector settings from calibration: { noiseDb, low, high }. */
export function configure(opts) {
  detectorOpts = { ...detectorOpts, ...opts };
  if (analyzer) detector = createNoteDetector(analyzer.sampleRate, detectorOpts);
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
    detector = createNoteDetector(sr, detectorOpts);
    ring = new Float32Array(FRAME_SIZE);
    tap.port.onmessage = ({ data }) => {
      const { t, samples } = data;
      ring.copyWithin(0, samples.length);
      ring.set(samples, FRAME_SIZE - samples.length);
      const f = analyzer.analyze(ring);
      frameListeners.forEach((fn) => fn(f, t, ring));
      if (!detecting) return;
      for (const ev of detector.push(f, t)) {
        const e = { ...ev, perf: audio.contextToPerf(ev.time) };
        noteListeners.forEach((fn) => fn(e));
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

export function stop() {
  nodes.forEach((n) => { try { n.disconnect(); } catch { /* already */ } });
  nodes = [];
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  detecting = false;
  audio.setSession('playback');
  if (state === 'on' || state === 'starting') setState('off');
}
