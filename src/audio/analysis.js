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
      const [pitch, clarity] = pd.findPitch(frame, sampleRate);
      return { rmsDb, bandDb, flux: flux / (hi - lo + 1), pitch, clarity };
    },
  };
}
