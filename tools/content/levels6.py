"""Phase 6 levels: Intermediate 1–13 + test, Advanced 1–12, 15 + test.
(Intermediate 14–15 and Advanced 13–14 are songs, written by songs6.py.)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from midi2tok import convert

root = sys.argv[1]
MIDI = sys.argv[2]


def T(d, mn, mx):
    return {"default": d, "min": mn, "max": mx}


def text(title, t):
    return {"kind": "text", "title": title, "text": t}


def note(n, f, title, t, clef=None):
    c = {"kind": "note", "note": n, "title": title, "text": t}
    if f:
        c["finger"] = f
    if clef:
        c["clef"] = clef
    return c


def keys(title, t, hl):
    return {"kind": "keys", "title": title, "text": t, "highlight": hl}


def J(*bars):
    return ' | '.join(bars)


MIC = text("How the mic scores this", "Where both hands start notes together, Keyboard mode scores your right hand (the top note). Both hands get scored once chord detection lands. Taps mode scores every note.")

L = {}

# ================================================================ INTERMEDIATE
L["intermediate/01"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(72, 45, 110),
  "intro": [text("Hands together", "Your left hand holds one long note per bar while the right hand plays the melody you know: Ode to Joy. Start slow in Practice: you can pick the bars and loop them."), MIC],
  "parts": {"rh": J("E4/q:3 E4/q F4/q:4 G4/q:5", "G4/q F4/q:4 E4/q:3 D4/q:2", "C4/q:1 C4/q D4/q:2 E4/q:3", "E4/qd:3 D4/8:2 D4/h", "E4/q:3 E4/q F4/q:4 G4/q:5", "G4/q F4/q:4 E4/q:3 D4/q:2", "C4/q:1 C4/q D4/q:2 E4/q:3", "D4/qd:2 C4/8:1 C4/h"),
            "lh": J("C3/w:5", "G3/w:1", "C3/w:5", "G3/w:1", "C3/w:5", "G3/w:1", "C3/w:5", "G3/h:1 C3/h:5")}}

L["intermediate/02"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(72, 45, 110),
  "intro": [text("Parallel motion", "Both hands play the same notes, an octave apart. The fingers don't match: right thumb on C4, left pinky on C3. Watch the left hand's finger numbers.")],
  "parts": {"rh": J("C4/q:1 D4/q:2 E4/q:3 F4/q:4", "G4/h:5 E4/h:3", "F4/q:4 E4/q:3 D4/q:2 E4/q:3", "C4/w:1", "E4/q:3 F4/q:4 G4/q:5 E4/q:3", "D4/q:2 E4/q:3 C4/h:1", "D4/q:2 E4/q:3 F4/q:4 D4/q:2", "C4/w:1"),
            "lh": J("C3/q:5 D3/q:4 E3/q:3 F3/q:2", "G3/h:1 E3/h:3", "F3/q:2 E3/q:3 D3/q:4 E3/q:3", "C3/w:5", "E3/q:3 F3/q:2 G3/q:1 E3/q:3", "D3/q:4 E3/q:3 C3/h:5", "D3/q:4 E3/q:3 F3/q:2 D3/q:4", "C3/w:5")}}

L["intermediate/03"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(72, 45, 110),
  "intro": [text("Contrary motion", "Now the hands mirror each other: when the right hand steps up, the left steps down. Both thumbs start on a C, and the same finger numbers play at the same time.")],
  "parts": {"rh": J("C4/q:1 D4/q:2 E4/q:3 F4/q:4", "G4/w:5", "G4/q:5 F4/q:4 E4/q:3 D4/q:2", "C4/w:1", "C4/q:1 E4/q:3 D4/q:2 F4/q:4", "E4/q:3 G4/q:5 E4/h:3", "D4/q:2 E4/q:3 D4/q:2 C4/q:1", "C4/w:1"),
            "lh": J("C3/q:1 B2/q:2 A2/q:3 G2/q:4", "F2/w:5", "F2/q:5 G2/q:4 A2/q:3 B2/q:2", "C3/w:1", "C3/q:1 A2/q:3 B2/q:2 G2/q:4", "A2/q:3 F2/q:5 A2/h:3", "B2/q:2 A2/q:3 B2/q:2 C3/q:1", "C3/w:1")}}

L["intermediate/04"] = {"type": "find", "show": "both", "clef": "treble",
  "prompts": ["F#4", "Bb4", "C#4", "Eb4", "G#4", "Db5", "A#4", "Gb4", "D#5", "Ab4", "C#5", "Bb3", "F#5", "Eb5"],
  "hints": {"A#4": "same key as B♭4", "Gb4": "same key as F♯4", "D#5": "same key as E♭5", "Db5": "same key as C♯5", "Ab4": "same key as G♯4", "Bb3": "below middle C"},
  "intro": [
    keys("Sharps", "A sharp (♯) raises a note to the very next key on the right. F♯ is the black key just right of F.", ["F#4", "C#4", "G#4"]),
    keys("Flats", "A flat (♭) lowers a note to the very next key on the left. B♭ is the black key just left of B.", ["Bb4", "Eb4", "Ab4"]),
    keys("Two names, one key", "C♯ and D♭ are the same black key. Notes like this are “enharmonic”. White keys can do it too: E♯ is F, and C♭ is B.", ["C#4"]),
    text("How this drill works", "A note appears on the staff with its name. Find the key and play it. Only your first answer counts."),
  ]}

L["intermediate/05"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(76, 45, 110),
  "intro": [text("Accidentals", "A sharp, flat or natural written in the music (not in the key signature) is an accidental. It lasts until the end of its bar."),
            text("Naturals", "A natural (♮) cancels a sharp or flat: play the white key. In bar 2, the F♯ is followed by an F natural in the same bar.")],
  "parts": {"rh": J("E4/q F#4/q G4/q F#4/q", "G4/q F#4/q F4/q E4/q", "A4/q G#4/q A4/q E4/q", "F4/q E4/q D#4/q E4/q", "C5/q B4/q Bb4/q A4/q", "G4/q F#4/q G4/q A4/q", "Bb4/q A4/q G4/q F#4/q", "G4/w"),
            "lh": J("E3/w", "C3/w", "A2/w", "E3/w", "F3/w", "D3/w", "D3/w", "G2/w")}}

L["intermediate/06"] = {"hands": "both", "key": "D", "time": "4/4", "tempo": T(80, 50, 120),
  "intro": [text("D major", "Two sharps: every F and every C is sharp. Put your right thumb on D4: D E F♯ G A. Finger 3 sits on the black key F♯."),
            note("F#4", 3, "F sharp", "The black key just right of F."),
            text("B♭ major", "B♭ major has two flats, B♭ and E♭. You'll meet it in the section test.")],
  "parts": {"rh": J("D4/q:1 E4/q:2 F#4/q:3 G4/q:4", "A4/h:5 F#4/h:3", "G4/q:4 E4/q:2 A4/q:5 G4/q:4", "F#4/w:3", "A4/q:5 G4/q:4 F#4/q:3 E4/q:2", "D4/q:1 F#4/q:3 E4/h:2", "F#4/q:3 E4/q:2 D4/q:1 E4/q:2", "D4/w:1"),
            "lh": J("D3/w:5", "D3/h:5 F#3/h:3", "E3/h:4 G3/h:2", "A3/w:1", "F#3/h:3 G3/h:2", "A3/h:1 G3/h:2", "A3/h:1 A3/h", "D3/w:5")}}

L["intermediate/07"] = {"hands": "both", "key": "Am", "time": "4/4", "tempo": T(76, 45, 110),
  "intro": [text("Minor keys", "A minor uses the same key signature as C major (no sharps or flats) but centres on A. It sounds darker."),
            text("Harmonic minor", "Raising the 7th note gives the harmonic minor: in A minor, G becomes G♯. E minor works the same way: one sharp (F♯), with D♯ raised."),
            note("G#4", 1, "G sharp", "The black key just right of G. Here your thumb slides down onto it.")],
  "parts": {"rh": J("A4/q:1 B4/q:2 C5/q:3 D5/q:4", "E5/h:5 C5/h:3", "D5/q:4 C5/q:3 B4/q:2 A4/q:1", "B4/w:2", "C5/q:3 B4/q:2 A4/q:1 G#4/q:1", "A4/q:2 B4/q:3 C5/h:4", "B4/q:3 A4/q:2 G#4/q:1 B4/q:3", "A4/w:2"),
            "lh": J("A2/w:5", "A2/h:5 C3/h:3", "D3/h:2 B2/h:4", "E3/w:1", "A2/h:5 C3/h:3", "D3/h:2 C3/h:3", "E3/h:1 E2/h", "A2/w:5")}}

L["intermediate/08"] = {"hands": "right", "key": "C", "time": "4/4", "tempo": T(80, 45, 120),
  "intro": [text("Thumb under", "A scale has 8 notes but you have 5 fingers. In C major the right thumb tucks under finger 3 to land on F, then the hand carries on: 1 2 3 1 2 3 4 5."),
            text("Three scales", "C major (bars 1–4), G major with F♯ (5–8), F major with B♭ (9–12). In F major the thumb goes under finger 4: 1 2 3 4 1 2 3 4.")],
  "parts": {"rh": J("C4/q:1 D4/q:2 E4/q:3 F4/q:1", "G4/q:2 A4/q:3 B4/q:4 C5/q:5", "C5/q:5 B4/q:4 A4/q:3 G4/q:2", "F4/q:1 E4/q:3 D4/q:2 C4/q:1",
                    "G4/q:1 A4/q:2 B4/q:3 C5/q:1", "D5/q:2 E5/q:3 F#5/q:4 G5/q:5", "G5/q:5 F#5/q:4 E5/q:3 D5/q:2", "C5/q:1 B4/q:3 A4/q:2 G4/q:1",
                    "F4/q:1 G4/q:2 A4/q:3 Bb4/q:4", "C5/q:1 D5/q:2 E5/q:3 F5/q:4", "F5/q:4 E5/q:3 D5/q:2 C5/q:1", "Bb4/q:4 A4/q:3 G4/q:2 F4/q:1")}}

L["intermediate/09"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(72, 40, 110),
  "intro": [text("Left-hand scale", "The left hand goes up 5 4 3 2 1, then finger 3 crosses over the thumb: 3 2 1. Coming down, the thumb passes under finger 3."),
            text("Both hands", "Bars 5–8 play the scale in both hands, an octave apart. The thumbs cross at different moments, so go slowly: try 50 BPM in Practice.")],
  "parts": {"rh": J("r/w", "r/w", "r/w", "r/w", "C4/q:1 D4/q:2 E4/q:3 F4/q:1", "G4/q:2 A4/q:3 B4/q:4 C5/q:5", "C5/q:5 B4/q:4 A4/q:3 G4/q:2", "F4/q:1 E4/q:3 D4/q:2 C4/q:1", "C4/w:1"),
            "lh": J("C3/q:5 D3/q:4 E3/q:3 F3/q:2", "G3/q:1 A3/q:3 B3/q:2 C4/q:1", "C4/q:1 B3/q:2 A3/q:3 G3/q:1", "F3/q:2 E3/q:3 D3/q:4 C3/q:5",
                    "C3/q:5 D3/q:4 E3/q:3 F3/q:2", "G3/q:1 A3/q:3 B3/q:2 C4/q:1", "C4/q:1 B3/q:2 A3/q:3 G3/q:1", "F3/q:2 E3/q:3 D3/q:4 C3/q:5", "C3/w:5")}}

L["intermediate/10"] = {"hands": "right", "key": "C", "time": "4/4", "tempo": T(72, 45, 110),
  "intro": [text("Intervals", "An interval is the distance between two notes. Count the letter names, including both ends: C to E is C-D-E, a 3rd. C to C is an octave (8th)."),
            text("On the staff", "2nds go line to space, 3rds line to line, 5ths skip two lines. Bars 1–7 go up from C: 2nd, 3rd, 4th, 5th, 6th, 7th, octave. Then mixed.")],
  "parts": {"rh": J("C4/h:1 D4/h:2", "C4/h:1 E4/h:3", "C4/h:1 F4/h:4", "C4/h:1 G4/h:5", "C4/h:1 A4/h:5", "C4/h:1 B4/h:5", "C4/h:1 C5/h:5",
                    "G4/q:5 E4/q:3 C4/q:1 G4/q:5", "F4/q:4 D4/q:2 F4/q:4 C4/q:1", "E4/q:3 G4/q:5 D4/q:2 F4/q:4", "C4/q:1 G4/q:5 C4/q:1 E4/q:3", "C4/w:1")}}

L["intermediate/11"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(80, 50, 120),
  "intro": [text("Triads", "A triad is three notes a 3rd apart: root, 3rd, 5th. Here you play them one note at a time (broken), up and down."),
            text("Major and minor", "C, F and G are major (bright). D, E and A are minor (darker): their middle note is one key lower. The left hand plays each root.")],
  "parts": {"rh": J("C4/q:1 E4/q:3 G4/q:5 E4/q:3", "D4/q:1 F4/q:3 A4/q:5 F4/q:3", "E4/q:1 G4/q:3 B4/q:5 G4/q:3", "F4/q:1 A4/q:3 C5/q:5 A4/q:3",
                    "G4/q:1 B4/q:3 D5/q:5 B4/q:3", "A4/q:1 C5/q:3 E5/q:5 C5/q:3", "G4/q:1 B4/q:3 D5/q:5 B4/q:3", "C4/q:1 E4/q:3 G4/h:5"),
            "lh": J("C3/w", "D3/w", "E3/w", "F3/w", "G3/w", "A3/w", "G3/w", "C3/w")}}

L["intermediate/12"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(72, 45, 110),
  "intro": [text("Block chords", "Now all three triad notes at once. I is C major, IV is F major, V is G major. The right hand moves as little as possible: only one or two fingers change."), MIC],
  "parts": {"rh": J("[C4 E4 G4]/h:1-3-5 [C4 F4 A4]/h:1-4-5", "[C4 E4 G4]/h:1-3-5 [B3 D4 G4]/h:1-2-5", "[C4 E4 G4]/w:1-3-5", "[C4 F4 A4]/h:1-4-5 [B3 D4 G4]/h:1-2-5",
                    "[C4 E4 G4]/h [C4 F4 A4]/h", "[B3 D4 G4]/h [C4 E4 G4]/h", "[C4 F4 A4]/h [B3 D4 G4]/h", "[C4 E4 G4]/w"),
            "lh": J("C3/h F2/h", "C3/h G2/h", "C3/w", "F2/h G2/h", "C3/h F2/h", "G2/h C3/h", "F2/h G2/h", "C3/w")}}

L["intermediate/13"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(76, 45, 110),
  "intro": [text("Dynamics", "Dynamics say how loud: p (piano) soft, mp medium soft, mf medium loud, f (forte) loud. “cresc.” means get gradually louder, “dim.” gradually softer."),
            text("Not scored", "The app can't judge loudness yet, so dynamics don't change your score. Tap Listen to hear the shape, then copy it.")],
  "parts": {"rh": J("C4/q:1!p E4/q:3 G4/h:5", "F4/q:4 E4/q:3 D4/h:2", "E4/q:3!mf G4/q:5 F4/q:4 D4/q:2", "E4/w:3", "C4/q:1!cresc D4/q:2 E4/q:3 F4/q:4", "G4/q:5!f G4/q G4/h", "F4/q:4!dim E4/q:3 D4/q:2 E4/q:3", "C4/w:1!p"),
            "lh": J("C3/w:5!p", "G2/w", "C3/w:5!mf", "C3/w:5", "C3/h:5!cresc F3/h:2", "E3/h:3!f C3/h:5", "G2/w!dim", "C3/w:5!p")}}

L["intermediate/test"] = {"hands": "both", "key": "Bb", "time": "4/4", "tempo": T(84, 84, 84),
  "parts": {"rh": J("Bb4/q D5/q F5/h", "Eb5/q C5/q A4/h", "Bb4/q C5/q D5/q Eb5/q", "F5/w", "G5/q F5/q Eb5/q D5/q", "C5/q D5/q Eb5/h", "D5/q C5/q B4/q D5/q", "C5/w",
                    "F5/q!f Eb5/q D5/q C5/q", "Bb4/q A4/q G4/q A4/q", "Bb4/q!dim D5/q C5/q A4/q", "Bb4/w!p"),
            "lh": J("Bb2/w", "F2/w", "Bb2/h G2/h", "F2/w", "Eb3/h C3/h", "F2/w", "G2/w", "C3/w", "F2/w", "G2/h F2/h", "F2/h F2/h", "Bb2/w")}}

# ================================================================ ADVANCED
L["advanced/01"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(76, 45, 110),
  "intro": [text("Inversions", "Any note of a chord can be on the bottom. Root position C-E-G; first inversion E-G-C (the root on top); second inversion G-C-E. Same chord, different shape."),
            text("Why", "Inversions let your hand move less between chords: bars 7–8 move from F to G to C by changing one or two fingers."), MIC],
  "parts": {"rh": J("[C4 E4 G4]/h:1-3-5 [E4 G4 C5]/h:1-2-5", "[G4 C5 E5]/w:1-3-5", "[F4 A4 C5]/h:1-3-5 [A4 C5 F5]/h:1-2-5", "[C4 F4 A4]/w:1-3-5",
                    "[G4 B4 D5]/h:1-3-5 [B4 D5 G5]/h:1-2-5", "[D4 G4 B4]/w:1-3-5", "[C4 F4 A4]/h:1-3-5 [B3 D4 G4]/h:1-2-5", "[C4 E4 G4]/w:1-3-5"),
            "lh": J("C3/w", "C3/w", "F2/w", "F2/w", "G2/w", "G2/w", "F2/h G2/h", "C3/w")}}

L["advanced/02"] = {"hands": "both", "key": "G", "time": "4/4", "tempo": T(80, 50, 120),
  "intro": [text("Progressions", "Roman numerals name chords by scale step. In G major: I = G, IV = C, V = D, vi = E minor. I–IV–V–I is the classic cadence (bars 1–4)."),
            text("The pop progression", "I–V–vi–IV (bars 5–8) is in thousands of songs. Learn the shapes here and you can play it in any key."), MIC],
  "parts": {"rh": J("[B3 D4 G4]/h:1-2-5 [C4 E4 G4]/h:1-3-5", "[A3 D4 F#4]/h:1-3-5 [B3 D4 G4]/h:1-2-5", "[B3 D4 G4]/h:1-2-5 [C4 E4 G4]/h:1-3-5", "[A3 D4 F#4]/h:1-3-5 [B3 D4 G4]/h:1-2-5",
                    "[B3 D4 G4]/h:1-2-5 [A3 D4 F#4]/h:1-3-5", "[B3 E4 G4]/h:1-3-5 [C4 E4 G4]/h:1-3-5", "[B3 D4 G4]/h [A3 D4 F#4]/h", "[B3 E4 G4]/h [C4 E4 G4]/h", "[B3 D4 G4]/w"),
            "lh": J("G2/h C3/h", "D3/h G2/h", "G2/h C3/h", "D3/h G2/h", "G2/h D3/h", "E3/h C3/h", "G2/h D3/h", "E3/h C3/h", "G2/w")}}

L["advanced/03"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(72, 45, 110),
  "intro": [text("Accompaniment patterns", "Instead of block chords, the left hand can spread a chord out. The Alberti bass plays bottom-top-middle-top in steady eighths: C G E G."),
            text("Mozart", "Bars 1–4 are the opening of Mozart's Sonata in C, K. 545 (1788). Keep the left hand soft and even under the tune.")],
  "parts": {"rh": J("C5/h:1 E5/q:3 G5/q:5", "B4/qd:1 C5/16:2 D5/16:3 C5/h:2", "A5/h:5 G5/q:4 C6/q:5", "G5/q:3 F5/8:2 E5/8:1 F5/h:2",
                    "E5/q:3 D5/q:2 C5/q:1 E5/q:3", "D5/q:2 C5/q:1 B4/q:1 D5/q:3", "C5/q:2 B4/q:1 A4/q:1 G4/q:1", "C5/w:4"),
            "lh": J("C4/8:5 G4/8:1 E4/8:3 G4/8:1 C4/8:5 G4/8:1 E4/8:3 G4/8:1", "D4/8:5 G4/8:1 F4/8:2 G4/8:1 C4/8:5 G4/8:1 E4/8:3 G4/8:1",
                    "C4/8:5 A4/8:1 F4/8:3 A4/8:1 C4/8:5 G4/8:1 E4/8:3 G4/8:1", "B3/8:5 G4/8:1 D4/8:3 G4/8:1 C4/8:5 G4/8:1 E4/8:3 G4/8:1",
                    "A3/8 E4/8 C4/8 E4/8 A3/8 E4/8 C4/8 E4/8", "G3/8 D4/8 B3/8 D4/8 G3/8 D4/8 B3/8 D4/8", "F3/8 C4/8 A3/8 C4/8 G3/8 D4/8 B3/8 D4/8", "C4/8 G4/8 E4/8 G4/8 C4/h")}}

L["advanced/04"] = {"hands": "both", "key": "A", "time": "4/4", "tempo": T(84, 50, 120),
  "intro": [text("More keys", "Sharp keys add one sharp each time: G (F♯), D (+C♯), A (+G♯), E (+D♯). Flat keys add flats: F (B♭), B♭ (+E♭), E♭ (+A♭), A♭ (+D♭)."),
            text("Relative minors", "Every major key shares its signature with a minor key three notes below: D minor goes with F major, G minor with B♭ major."),
            text("A major", "Three sharps: F♯, C♯ and G♯. Right thumb on A4.")],
  "parts": {"rh": J("A4/q:1 B4/q:2 C#5/q:3 A4/q:1", "E5/h:5 C#5/h:3", "D5/q:4 C#5/q:3 B4/q:2 D5/q:4", "C#5/w:3", "E5/q:5 D5/q:4 C#5/q:3 B4/q:2", "A4/q:1 C#5/q:3 B4/h:2", "C#5/q:3 B4/q:2 A4/q:1 G#4/q:1", "A4/w:2"),
            "lh": J("A2/h E3/h", "A2/h C#3/h", "D3/h E3/h", "A2/w", "A2/h C#3/h", "D3/h E3/h", "E3/h E2/h", "A2/w")}}

L["advanced/05"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(66, 40, 100),
  "intro": [text("Sixteenth notes", "A sixteenth is a quarter of a beat: four per click, with two beams. Count “1 e & a, 2 e & a”. Start at 50 BPM in Practice and loop bar 3.")],
  "parts": {"rh": J("C4/16:1 D4/16:2 E4/16:3 F4/16:4 G4/q:5 G4/16:5 F4/16:4 E4/16:3 D4/16:2 C4/q:1",
                    "E4/8:3 E4/16 F4/16:4 G4/8:5 G4/8 F4/16:4 E4/16:3 D4/16:2 C4/16:1 D4/q:2",
                    "C4/16:1 E4/16:3 G4/16:5 E4/16:3 C4/16:1 E4/16:3 G4/16:5 E4/16:3 D4/16:2 F4/16:4 G4/16:5 F4/16:4 D4/16:2 F4/16:4 G4/16:5 F4/16:4",
                    "G4/16:5 F4/16:4 E4/16:3 D4/16:2 C4/8:1 E4/8:3 G4/h:5",
                    "F4/16:4 E4/16:3 D4/16:2 E4/16:3 F4/8:4 D4/8:2 E4/16:3 D4/16:2 C4/16:1 D4/16:2 E4/8:3 C4/8:1",
                    "D4/8:2 D4/16 E4/16:3 F4/8:4 F4/16 G4/16:5 E4/q:3 C4/q:1",
                    "G4/16:5 E4/16:3 F4/16:4 D4/16:2 E4/16:3 C4/16:1 D4/16:2 E4/16:3 F4/8:4 E4/8:3 D4/q:2", "C4/w:1"),
            "lh": J("C3/h G2/h", "C3/h G2/h", "C3/h G2/h", "G2/h C3/h", "F2/h C3/h", "G2/h C3/h", "C3/h G2/h", "C3/w")}}

L["advanced/06"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(84, 50, 120),
  "intro": [text("Syncopation", "Syncopation puts notes between the clicks and holds them across the beat. “1 & (2) & 3”: the quarter note in bar 1 starts on the “&” of 1 and covers beat 2."),
            text("Feel it", "The left hand keeps the beat in quarters: lock onto it, and let the right hand push against it.")],
  "parts": {"rh": J("C4/8:1 E4/q:3 E4/8 G4/h:5", "F4/8:4 E4/q:3 D4/8:2 C4/h:1", "E4/q:3 G4/8:5 G4/q G4/8 r/q", "A4/8 G4/8 E4/8 G4/8~ G4/h",
                    "r/8 C4/q:1 E4/q:3 G4/q:5 E4/8:3", "F4/8:4 D4/q:2 F4/8:4 E4/h:3", "D4/8:2 E4/8:3 F4/8:4 G4/8:5~ G4/8 F4/8:4 E4/8:3 D4/8:2", "C4/w:1"),
            "lh": J("C3/q G2/q C3/q G2/q", "G2/q B2/q C3/q G2/q", "C3/q G2/q C3/q G2/q", "A2/q E3/q C3/q G2/q", "C3/q G2/q C3/q G2/q", "G2/q B2/q C3/q G2/q", "G2/q B2/q D3/q B2/q", "C3/w")}}

L["advanced/07"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(72, 45, 110),
  "intro": [text("Triplets", "A triplet fits three notes into the time of two, marked with a 3. Three triplet eighths fill one click: count “1-trip-let, 2-trip-let”."),
            text("Straight vs triplet", "Bar 1 is straight eighths (two per click), bar 2 is triplets (three per click). Bar 5 has quarter-note triplets: three across two clicks.")],
  "parts": {"rh": J("C4/8:1 D4/8:2 E4/8:3 F4/8:4 G4/h:5", "C4/8t:1 D4/8t:2 E4/8t:3 F4/8t:4 G4/8t:5 E4/8t:3 C4/h:1", "E4/q:3 G4/8t:5 F4/8t:4 E4/8t:3 D4/h:2",
                    "C4/8t:1 E4/8t:3 G4/8t:5 E4/8t:3 C4/8t:1 E4/8t:3 D4/8:2 E4/8:3 C4/q:1", "G4/qt:5 F4/qt:4 E4/qt:3 D4/h:2", "E4/8:3 F4/8:4 G4/8t:5 F4/8t:4 E4/8t:3 D4/q:2 r/q",
                    "C4/8t:1 D4/8t:2 E4/8t:3 F4/8t:4 E4/8t:3 D4/8t:2 E4/8:3 D4/8:2 G4/q:5", "C4/w:1"),
            "lh": J("C3/w", "C3/h G2/h", "C3/h G2/h", "C3/w", "G2/w", "C3/h G2/h", "C3/h G2/h", "C3/w")}}

L["advanced/08"] = {"hands": "both", "key": "Dm", "time": "4/4", "tempo": T(72, 45, 104),
  "intro": [text("Hand independence", "The right hand sings a slow melody while the left hand ripples in steady eighths. Practise each hand alone first (Practice → Hands), then together slowly."),
            text("D minor", "One flat (B♭), like F major. The C♯ in bar 7 is the raised 7th of harmonic minor.")],
  "parts": {"rh": J("A4/h:5 F4/q:3 D4/q:1", "E4/qd:2 F4/8:3 G4/h:4", "A4/q:5 G4/q:4 F4/q:3 E4/q:2", "F4/h:3 D4/h:1", "Bb4/q:5 A4/q:4 G4/q:3 F4/q:2", "E4/q:1 F4/q:2 G4/q:3 A4/q:4", "G4/q:4 F4/q:3 E4/q:2 C#4/q:1", "D4/w:2"),
            "lh": J(*["{0}/8 {1}/8 {2}/8 {1}/8 {0}/8 {1}/8 {2}/8 {1}/8".format(*c) for c in [("D2", "A2", "D3"), ("C2", "G2", "C3"), ("F2", "C3", "F3"), ("D2", "A2", "D3"), ("G2", "D3", "G3"), ("C2", "G2", "C3"), ("A2", "E3", "A3")]], "D2/8 A2/8 D3/8 A2/8 D2/h")}}

L["advanced/09"] = {"hands": "both", "key": "G", "time": "6/8", "tempo": T(56, 36, 80),
  "intro": [text("Six-eight time", "6/8 has six eighth notes per bar, grouped in two sets of three. It's felt as two big beats, each a dotted quarter: “1-2-3, 4-5-6”."),
            text("Two clicks a bar", "The metronome clicks on the two big beats, and the tempo counts them. The long-short pattern (quarter, eighth) gives 6/8 its lilt.")],
  "parts": {"rh": J("G4/q:1 A4/8:2 B4/q:3 G4/8:1", "D5/qd:5 B4/qd:3", "C5/q:4 B4/8:3 A4/q:2 G4/8:1", "B4/8:3 A4/8:2 G4/8:1 A4/qd:2", "G4/q:1 A4/8:2 B4/q:3 C5/8:4", "D5/8:5 C5/8:4 B4/8:3 A4/qd:2", "C5/q:4 A4/8:2 B4/q:3 A4/8:2", "G4/qd:1 r/qd"),
            "lh": J("G2/qd D3/qd", "G2/qd B2/qd", "C3/qd D3/qd", "D3/hd", "G2/qd D3/qd", "G2/qd D3/qd", "C3/qd D3/qd", "G2/hd")}}

L["advanced/10"] = {"hands": "both", "noListen": True, "showFingers": False, "tempo": T(72, 45, 100),
  "generate": {"keys": ["C", "G", "F", "D", "Bb", "A", "Eb"], "times": ["4/4", "3/4"], "bars": 8, "hands": "both", "rhythm": "medium"},
  "intro": [text("Unseen passages", "Every visit makes a new passage you've never seen, in a random key and time. No Listen: read it cold."),
            text("Before you play", "Check the key signature, the time signature, the highest and lowest notes, and any rhythm you need to count. Then keep going, even after a mistake. “New passage” makes another one.")]}

L["advanced/11"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(76, 45, 110),
  "ottava": [{"part": "rh", "from": 3, "to": 4, "type": "8va"}, {"part": "rh", "from": 7, "to": 8, "type": "8va"}, {"part": "lh", "from": 7, "to": 8, "type": "8vb"}],
  "intro": [text("8va", "“8va” with a dashed line means: play these notes an octave (8 notes) higher than written. It saves a stack of ledger lines. Bars 3–4 look like bars 1–2 but sound an octave up."),
            text("8vb", "“8vb” under the staff means an octave lower. In bars 7–8 the left hand plays down near the bottom of your keyboard.")],
  "parts": {"rh": J("C5/q:1 D5/q:2 E5/q:3 F5/q:4", "G5/h:5 E5/h:3", "C6/q:1 D6/q:2 E6/q:3 F6/q:4", "G6/h:5 E6/h:3", "F5/q:4 E5/q:3 D5/q:2 E5/q:3", "C5/w:1", "F6/q:4 E6/q:3 D6/q:2 E6/q:3", "C6/w:1"),
            "lh": J("C3/w", "C3/h G2/h", "C3/w", "C3/h G2/h", "G2/w", "C3/w", "G2/w", "C2/w")}}

L["advanced/12"] = {"hands": "both", "key": "C", "time": "4/4", "tempo": T(80, 50, 120),
  "intro": [keys("Your range", "Your Casio runs from C2 to C7. A full piano has 88 keys, from A0 to C8, so some music goes past your ends.", ["C2", "C7"]),
            text("The fix", "1. Find the notes that don't fit. 2. Move the whole phrase an octave, not one note, so the tune keeps its shape. 3. Check the hands don't collide."),
            text("This piece", "It was written for 88 keys: bars 5–6 went up to C8 and the last bass note was C1. Here bars 5–6 are an octave lower and the bass is an octave higher.")],
  "parts": {"rh": J("E5/q C5/q G5/q E5/q", "C6/h G5/h", "A5/q F5/q C6/q A5/q", "G5/w", "E6/q C6/q G6/q E6/q", "C7/h G6/h", "D6/q B5/q G5/q B5/q", "C6/w"),
            "lh": J("C3/h G2/h", "C3/h E3/h", "F2/h C3/h", "G2/h D3/h", "C3/h G2/h", "C3/h E3/h", "G2/h B2/h", "C2/w")}}

# Capstone: Tchaikovsky, Old French Song (Op. 39 No. 16) — unseen, no Listen.
r, _ = convert(os.path.join(MIDI, '16OldFrenchSong.midi'), bar16=8, beat16=4, pickup16=2, bars=32, rh=2, lh=2, lh_keep='outer', flats=True, spell={6: 'F#', 1: 'C#'})
L["advanced/15"] = {"hands": "both", "key": "Gm", "time": "2/4", "pickup": True, "noListen": True, "tempo": T(66, 36, 92),
  "intro": [text("Capstone", "Tchaikovsky's Old French Song (1878), which you haven't heard here. No Listen button: learn it the way you'll learn any piece from now on."),
            text("1. Scan", "Key: G minor (two flats; F♯ is the raised 7th). Time: 2/4 with a one-note pickup. Find the highest and lowest notes and any repeated bars: bars 9–15 repeat bars 1–7."),
            text("2. Rhythm, then hands alone", "Practice at a slow tempo with the metronome. Pick 2–4 bars, turn on Loop, and play the right hand alone (Practice → Hands), then the left."),
            text("3. Together, then faster", "Hands together on the same bars, slowly. When a loop is clean twice in a row, add 4 BPM. Move on to the next bars and join them up."),
            text("4. Perform", "Play the whole piece in Scored play. That's the workflow for any sheet music: scan, slow, small chunks, hands alone, together, then speed.")],
  "parts": r,
  "credit": "Notes from the Mutopia Project edition (Tchaikovsky, Op. 39 No. 16, Schirmer 1904, public domain)."}

L["advanced/test"] = {"hands": "both", "key": "Eb", "time": "4/4", "tempo": T(76, 76, 76),
  "parts": {"rh": J("Eb4/q G4/q Bb4/q G4/q", "Ab4/8 G4/8 F4/8 G4/8~ G4/h", "Bb4/16 C5/16 Bb4/16 Ab4/16 G4/8 F4/8 Eb4/h", "F4/8t G4/8t Ab4/8t Bb4/8t C5/8t D5/8t Eb5/h",
                    "D5/q C5/q B4/q C5/q", "Ab4/8 Bb4/q C5/8 Bb4/h", "G4/16 Ab4/16 Bb4/16 G4/16 F4/8 Eb4/8 D4/q Eb4/q", "F4/w",
                    "Bb4/8t C5/8t D5/8t Eb5/q D5/8 C5/8 Bb4/q", "Ab4/q G4/8 F4/8~ F4/8 Eb4/8 D4/q", "Eb4/16 F4/16 G4/16 Ab4/16 Bb4/8 G4/8 F4/q D4/q", "Eb4/w"),
            "lh": J("Eb3/h Bb2/h", "Ab2/h Eb3/h", "Eb3/h G2/h", "Bb2/h Eb3/h", "G2/h C3/h", "F2/h Bb2/h", "Eb3/h Bb2/h", "Bb2/w", "Bb2/h G2/h", "Ab2/h Bb2/h", "C3/h Bb2/h", "[Eb2 Eb3]/w")}}

for k, v in L.items():
    path = os.path.join(root, 'levels', k + '.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(v, f, indent=2, ensure_ascii=False)
        f.write('\n')
print(len(L), 'levels/tests')
