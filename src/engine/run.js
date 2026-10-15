// One pass through a piece: either a "listen" demo (the app plays it) or a
// scored "play" attempt (count-in, optional metronome, the player plays it).
// Drives a frame callback with the current beat so the UI can move the playhead.
import * as audio from '../audio/engine.js';
import { createScorer } from './scorer.js';

export function createRun({
  notes, totalBeats, tempo, beatsPerBar, mode, windowMs, metronome = true, countInBeats = beatsPerBar,
  latencyMs = 0, onFrame = () => {}, onJudge = () => {}, onMiss = () => {}, onEnd = () => {},
}) {
  const spb = 60 / tempo;
  const msPerBeat = spb * 1000;
  const play = mode === 'play';
  const countIn = play ? countInBeats : 0;
  const scorer = play ? createScorer(notes.map((n) => ({ id: n.id, midi: n.midi, time: n.beat * msPerBeat })), { windowMs }) : null;

  const events = [];
  for (let i = 0; i < countIn; i++) {
    events.push({ at: i * spb, fn: (t) => audio.playClick(t, i % beatsPerBar === 0) });
  }
  if (play && metronome) {
    for (let b = 0; b < Math.ceil(totalBeats); b++) {
      events.push({ at: (countIn + b) * spb, fn: (t) => audio.playClick(t, b % beatsPerBar === 0) });
    }
  }
  if (!play) {
    for (const n of notes) {
      events.push({ at: (countIn + n.beat) * spb, fn: (t) => audio.playNote(n.midi, Math.max(0.25, n.beats * spb * 0.95), t, 0.75) });
    }
  }

  let raf = 0;
  let perfBeat0 = 0;
  let finished = false;
  const endBeat = totalBeats + (play ? windowMs / msPerBeat : 0) + 0.4;

  const finish = (completed) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    audio.stopAll();
    if (play && completed) scorer.tick(Infinity).forEach((n) => onMiss(n));
    onEnd({ completed, summary: scorer ? scorer.summary() : null });
  };

  const frame = () => {
    if (finished) return;
    const t = performance.now();
    const beat = (t - perfBeat0) / msPerBeat;
    if (scorer) {
      const missed = scorer.tick(t - perfBeat0 - latencyMs);
      missed.forEach((n) => onMiss(n, scorer));
    }
    onFrame(beat, scorer);
    if (beat >= endBeat) return finish(true);
    raf = requestAnimationFrame(frame);
  };

  return {
    mode,
    scorer,
    msPerBeat,
    start() {
      const startAt = audio.startTransport(events, 0.2);
      perfBeat0 = audio.audioToPerf(startAt + countIn * spb);
      raf = requestAnimationFrame(frame);
    },
    /** A key was played (timeStamp on the performance.now() clock). */
    input(midi, timeStamp = performance.now()) {
      if (!scorer || finished) return null;
      const res = scorer.input(midi, timeStamp - perfBeat0 - latencyMs);
      onJudge(res, scorer);
      return res;
    },
    stop() { finish(false); },
    /** performance.now() time at which beat 0 is heard. */
    get perfBeat0() { return perfBeat0; },
    get finished() { return finished; },
  };
}
