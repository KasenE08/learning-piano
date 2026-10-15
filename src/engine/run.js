// One pass through a piece: either a "listen" demo (the app plays it) or a
// scored "play" attempt (count-in, optional metronome, the player plays it).
// Drives a frame callback with the current beat so the UI can move the playhead.
import * as audio from '../audio/engine.js';
import { createScorer } from './scorer.js';

export function createRun({
  notes, ghosts = [], totalBeats, tempo, beatsPerBar, pulse = 1, mode, windowMs, metronome = true, countInBeats = beatsPerBar,
  latencyMs = 0, judgeDelayMs = 0, onFrame = () => {}, onJudge = () => {}, onMiss = () => {}, onEnd = () => {},
}) {
  const spb = 60 / tempo;
  const msPerBeat = spb * 1000;
  const play = mode === 'play';
  const countIn = play ? countInBeats : 0;
  const scorer = play ? createScorer(notes.map((n) => ({ id: n.id, midi: n.midi, time: n.beat * msPerBeat })), {
    windowMs, ghosts: ghosts.map((n) => ({ midi: n.midi, time: n.beat * msPerBeat })),
  }) : null;

  // Clicks fall every `pulse` beats (a dotted quarter in 6/8); bar starts are accented.
  const events = [];
  const downbeat = (b) => Math.abs(b / beatsPerBar - Math.round(b / beatsPerBar)) < 1e-6;
  for (let b = 0; b < countIn - 1e-6; b += pulse) {
    events.push({ at: b * spb, fn: (t) => audio.playClick(t, downbeat(b)) });
  }
  if (play && metronome) {
    for (let b = 0; b < totalBeats - 1e-6; b += pulse) {
      events.push({ at: (countIn + b) * spb, fn: (t) => audio.playClick(t, downbeat(b)) });
    }
  }
  if (!play) {
    for (const n of notes) {
      events.push({ at: (countIn + n.beat) * spb, fn: (t) => audio.playNote(n.midi, Math.max(0.25, n.beats * spb * 0.95), t, n.vel ?? 0.75) });
    }
  }

  let raf = 0;
  let perfBeat0 = 0;
  let finished = false;
  // Mic notes arrive a little after they are played, so misses are called later.
  const endBeat = totalBeats + (play ? (windowMs + judgeDelayMs) / msPerBeat : 0) + 0.4;

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
      const missed = scorer.tick(t - perfBeat0 - latencyMs - judgeDelayMs);
      missed.forEach((n) => onMiss(n, scorer));
    }
    onFrame(beat, scorer);
    if (beat >= endBeat) return finish(true);
    raf = requestAnimationFrame(frame);
  };

  return {
    mode,
    scorer,
    pulse,
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
