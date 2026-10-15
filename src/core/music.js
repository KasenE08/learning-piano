// Note naming helpers. MIDI 60 = C4 (middle C).
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);

export const isBlack = (midi) => BLACK.has(((midi % 12) + 12) % 12);
export const octaveOf = (midi) => Math.floor(midi / 12) - 1;
export const nameOf = (midi) => SHARP_NAMES[((midi % 12) + 12) % 12] + octaveOf(midi);

export function midiOf(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name: ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

export const frequencyOf = (midi) => 440 * 2 ** ((midi - 69) / 12);
