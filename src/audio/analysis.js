// Per-frame audio features for note detection. Pure (no Web Audio), so it runs
// in tests and on the main thread alike.
//  - pitch + clarity: McLeod pitch method (pitchy)
//  - bandDb: energy in the piano "body" band (50–2500 Hz). The metronome click is
//    high-passed noise above that band, so it barely moves this value.
//  - flux: log-compressed spectral flux over the same band — rises sharply on a
//    key strike, including a repeated strike of a note that is still ringing.
import { PitchDetector } from 'pitchy';
import FFT from 'fft.js';

export const FRAME_SIZE = 2048;
export const HOP_SIZE = 512;
const BAND_LO = 50;
const BAND_HI = 2500;

export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const db = (x) => 10 * Math.log10(x + 1e-12);

// McLeod can lock onto half a note's period when its even harmonics far outweigh
// its odd ones (a keyboard sample heard through a phone mic, say), and so name it
// an octave up: G3 heard as G4. The real note's odd harmonics still sound halfway
// between the named pitch's own (at 1.5× and 2.5× it), where that note has nothing.
// Judged on what this strike brought (louder than ~40 ms ago, and mostly new), so a
// held lower note, whose partials also sit there, doesn't count. Above SUB_MIN_HZ those in-between spots
// sit far enough apart in a 2048-point FFT.
const SUB_MIN_HZ = 300;
const SUB_MAX_HZ = 3000; // up to 2.75× the named pitch is looked at
const SUB_SHARE = 0.02; // each odd harmonic vs the named pitch's strongest of its first two
const SUB_CLEAR = 3; // and a clear peak: this much above the gaps either side
const SUB_NEW = 0.6; // and mostly new: most of what sounds there came with this strike
export function octaveBelow(rise, mag, binHz, f) {
  // The bin where `rise` peaks within one of hz (stiff strings run a little sharp);
  // its rise, or 0 unless it's a real peak there (not the skirt of a stronger partial
  // nearby) and mostly new.
  const peak = (hz) => {
    const c = Math.round(hz / binHz);
    let k = c;
    for (const j of [c - 1, c + 1]) if (rise[j] > rise[k]) k = j;
    return rise[k] >= rise[k - 1] && rise[k] >= rise[k + 1] && rise[k] >= SUB_NEW * mag[k] ? rise[k] : 0;
  };
  const at = (hz) => mag[Math.round(hz / binHz)];
  const ref = Math.max(peak(f), peak(2 * f));
  return ref > 0 && [1.5, 2.5].every((h) => {
    const p = peak(h * f);
    return p >= SUB_SHARE * ref && p >= SUB_CLEAR * Math.max(at((h - 0.25) * f), at((h + 0.25) * f));
  });
}

export function createAnalyzer(sampleRate, size = FRAME_SIZE) {
  const pd = PitchDetector.forFloat32Array(size);
  pd.minVolumeDecibels = -70;
  pd.clarityThreshold = 0.8;
  const fft = new FFT(size);
  const spec = fft.createComplexArray();
  const windowed = new Float32Array(size);
  const hann = new Float32Array(size);
  for (let i = 0; i < size; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  const lo = Math.max(1, Math.floor((BAND_LO * size) / sampleRate));
  const hi = Math.min(size / 2 - 1, Math.ceil((BAND_HI * size) / sampleRate));
  const prevLog = new Float32Array(hi + 1);
  // Magnitude spectra of the last few frames (up to SUB_MAX_HZ), to see what just rose.
  const binHz = sampleRate / size;
  const subBins = Math.min(size / 2, Math.ceil(SUB_MAX_HZ / binHz) + 3);
  const ago = Array.from({ length: 4 }, () => new Float32Array(subBins));
  let agoAt = 0;
  const rise = new Float32Array(subBins);
  const mag = new Float32Array(subBins);

  return {
    sampleRate,
    size,
    /** @param {Float32Array} frame  the latest `size` samples */
    analyze(frame) {
      let sq = 0;
      for (let i = 0; i < size; i++) {
        const s = frame[i];
        sq += s * s;
        windowed[i] = s * hann[i];
      }
      const rmsDb = db(sq / size);
      fft.realTransform(spec, windowed);
      let band = 0;
      let flux = 0;
      for (let k = lo; k <= hi; k++) {
        const re = spec[2 * k];
        const im = spec[2 * k + 1];
        const p = re * re + im * im;
        band += p;
        const l = Math.log1p(Math.sqrt(p) * 100);
        const d = l - prevLog[k];
        if (d > 0) flux += d;
        prevLog[k] = l;
      }
      const bandDb = db(band / (size * size)) + 6;
      const old = ago[agoAt]; // 4 frames back
      for (let k = 0; k < subBins; k++) {
        mag[k] = Math.hypot(spec[2 * k], spec[2 * k + 1]);
        rise[k] = Math.max(0, mag[k] - old[k]);
        old[k] = mag[k];
      }
      agoAt = (agoAt + 1) % ago.length;
      const [pitch, clarity] = pd.findPitch(frame, sampleRate);
      // sub: this pitch may really be the note an octave below (see octaveBelow).
      const sub = clarity >= 0.8 && pitch >= SUB_MIN_HZ && pitch * 2.75 < SUB_MAX_HZ && octaveBelow(rise, mag, binHz, pitch);
      return { rmsDb, bandDb, flux: flux / (hi - lo + 1), pitch, clarity, sub };
    },
  };
}
