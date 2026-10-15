// Pure helpers for the calibration screen.

const sorted = (a) => [...a].sort((x, y) => x - y);
export const median = (a) => {
  if (!a.length) return NaN;
  const s = sorted(a);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (a, p) => {
  const s = sorted(a);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};

/** Room noise from band levels (dB) recorded in silence: the 90th percentile. */
export function noiseFloor(levels) {
  const floor = percentile(levels, 90);
  const rating = floor < -62 ? 'quiet' : floor < -50 ? 'ok' : 'noisy';
  return { noiseDb: Math.round(floor * 10) / 10, rating };
}

/** How well the keyboard reaches the mic. peakDb: loudest note level; clipped: samples hit full scale. */
export function levelVerdict(peakDb, noiseDb, clipped = false) {
  if (clipped || peakDb > -3) return { ok: false, rating: 'loud', tip: 'Too loud: turn the keyboard down or move the phone back a little.' };
  const snr = peakDb - noiseDb;
  if (snr >= 25) return { ok: true, rating: 'great', tip: 'Great: your playing is well above the room noise.' };
  if (snr >= 15) return { ok: true, rating: 'ok', tip: 'OK: a little louder (or closer) would make detection more reliable.' };
  return { ok: false, rating: 'quiet', tip: 'Too quiet: turn the keyboard up or move the phone closer to its speakers.' };
}

/** For each click time, the offset (ms) to the nearest played note within ±maxMs. */
export function clickOffsets(clicks, notes, maxMs = 350) {
  const out = [];
  for (const c of clicks) {
    let best = null;
    for (const n of notes) {
      const d = n - c;
      if (Math.abs(d) <= maxMs && (best == null || Math.abs(d) < Math.abs(best))) best = d;
    }
    if (best != null) out.push(best);
  }
  return out;
}

/** Latency = median offset; spread = median absolute deviation. Needs ≥ 5 good taps. */
export function latencyFromOffsets(offsets) {
  if (offsets.length < 5) return { ok: false, reason: 'few', latencyMs: null, spreadMs: null };
  const lat = median(offsets);
  const spread = median(offsets.map((o) => Math.abs(o - lat)));
  return {
    ok: spread <= 45,
    reason: spread <= 45 ? null : 'uneven',
    latencyMs: Math.round(lat),
    spreadMs: Math.round(spread),
  };
}
