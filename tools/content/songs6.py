"""Phase 6 songs: converted from Mutopia Project LilyPond sources (via MIDI) or
arranged by hand from those sources. Writes song and level-song JSON files."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from midi2tok import convert, no_octaves

root = sys.argv[1]
MIDI = sys.argv[2]
M = lambda f: os.path.join(MIDI, f)


def T(d, mn, mx):
    return {"default": d, "min": mn, "max": mx}


def bars(s):
    return [b.strip() for b in s.split(' | ')]


def join(*parts):
    return ' | '.join(b for p in parts for b in (p if isinstance(p, list) else bars(p)))


def cut(src, a, b):
    """1-based inclusive bar range from a converted part (bar 0 = pickup when present)."""
    return bars(src)[a:b + 1] if src is not None else []


def auto_clefs(lh_bars, start='bass'):
    """Bass/treble per bar for a left-hand part, with hysteresis."""
    import re
    from statistics import median
    changes, cur = [], start
    for i, b in enumerate(lh_bars):
        ps = []
        for name in re.findall(r'([A-G][#b]?)(-?\d)', b):
            base = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[name[0][0]]
            acc = 1 if '#' in name[0] else -1 if 'b' in name[0][1:] else 0
            ps.append((int(name[1]) + 1) * 12 + base + acc)
        if not ps:
            continue
        m = median(ps)
        # Deep bass notes keep the bass clef; treble only when the whole bar sits high.
        want = 'bass' if min(ps) < 48 or m <= 57 else 'treble' if m >= 62 and min(ps) >= 53 else cur
        if want != cur:
            changes.append([i + 1, want])
            cur = want
    return changes


def credit(src):
    return f"Notes from the Mutopia Project edition ({src})."


OUT = {}

# ---------------------------------------------------------------- Minuet in G (Intermediate 14)
r, _ = convert(M('anna-magdalena-04.midi'), bar16=12, beat16=4, bars=48, rh=1, lh=1, lh_keep='bottom')
rh, lh = bars(r['rh']), bars(r['lh'])
rh, lh = rh[0:16] + rh[32:48], lh[0:16] + lh[32:48]
OUT['levels/intermediate/14'] = {
    "hands": "both", "key": "G", "time": "3/4", "tempo": T(100, 60, 140),
    "intro": [
        {"kind": "text", "title": "Minuet in G", "text": "From the notebook Bach gave his wife Anna Magdalena in 1725, now credited to Christian Petzold. A minuet is a dance in 3: lean on beat 1. Both hands play one note at a time."},
        {"kind": "text", "title": "Two sections", "text": "Bars 1–16 are the A section in G major. Bars 17–32 are the B section: it moves to D major, then comes home to G. Use Practice to loop any bars that trip you up."},
    ],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Bach, Anna Magdalena Notebook, Anh. 114, typeset by Allen Garvin"),
}

# ---------------------------------------------------------------- Für Elise (Intermediate 15)
r, _ = convert(M('fur_Elise_WoO59.midi'), bar16=6, beat16=2, pickup16=2, bars=44, rh=2, lh=2)
rh, lh = bars(r['rh']), bars(r['lh'])
for b in (20, 34):  # hand-crossing bars: keep the right hand's notes only
    lh[b] = 'E2/16 E3/16 E4/16 r/16 r/8'
    lh[b + 1] = 'r/qd'
    lh[b + 2] = 'r/qd'
rh[44] = 'A4/qd'
lh[44] = 'A2/16 E3/16 A3/16 r/16 r/8'
OUT['levels/intermediate/15'] = {
    "hands": "both", "key": "Am", "time": "3/8", "pickup": True, "tempo": T(120, 70, 160),
    "intro": [
        {"kind": "text", "title": "Für Elise", "text": "Beethoven, 1810. It's in 3/8: three eighth notes per bar, and the clicks are eighths. The hands take turns, so play the left-hand arpeggios softly under the tune."},
        {"kind": "text", "title": "D sharp and E", "text": "The famous opening rocks between E and D♯ (the black key just left of E). Keep your hand still and let fingers 4 and 5 do the work. Bars 17–22 move to C major, then the opening returns."},
    ],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Beethoven, WoO 59, typeset by Stelios Samelis"),
}

# ---------------------------------------------------------------- Prelude in C (Advanced 13)
SP = {10: 'Bb', 3: 'Eb', 8: 'Ab', 6: 'F#', 1: 'C#'}
r, _ = convert(M('wtk1-prelude1.midi'), bar16=16, beat16=4, bars=35, rh=1, lh=1, rh_keep='top', lh_keep='bottom', spell=SP)
rh, lh = bars(r['rh']), bars(r['lh'])
rh[34] = '[E4 G4 C5]/w'
lh[34] = '[C2 C3]/w'
OUT['levels/advanced/13'] = {
    "hands": "both", "key": "C", "time": "4/4", "tempo": T(60, 36, 84),
    "intro": [
        {"kind": "text", "title": "Prelude in C", "text": "Bach, The Well-Tempered Clavier, 1722. Every bar is one chord, broken into the same pattern: two notes in the left hand, then the right hand's three notes twice. Learn the pattern once and read only the chord."},
        {"kind": "text", "title": "Fitting 61 keys", "text": "The whole prelude fits your keyboard: the lowest note is the C2 at your far left in the last bars. The hands never play at the same time, so the mic scores every note."},
    ],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Bach, BWV 846, typeset by Tobias Erbsland"),
}

# ---------------------------------------------------------------- Gymnopédie No. 1 (Advanced 14)
r, _ = convert(M('gymnopedie_1.midi'), bar16=12, beat16=4, bars=39, rh=2, lh=3, rh_keep='top', lh_keep='outer')
rh, lh = bars(r['rh']), bars(r['lh'])
OUT['levels/advanced/14'] = {
    "hands": "both", "key": "D", "time": "3/4", "tempo": T(66, 44, 90),
    "intro": [
        {"kind": "text", "title": "Gymnopédie No. 1", "text": "Satie, 1888: “slow and sorrowful”. The left hand swings between a low bass note on beat 1 and a chord on beat 2. The melody floats over it, mostly in long notes."},
        {"kind": "text", "title": "The bass leap", "text": "The left hand jumps an octave or more every bar. Look at the next bass note, not your hand, and let the chord on beat 2 be quiet."},
    ],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Satie, Gymnopédie No. 1, public domain"),
}

# ---------------------------------------------------------------- songs
SONGS = {}

# In the Hall of the Mountain King (unlocks at Intermediate 7: minor keys)
A1 = ['B3/8 C#4/8 D4/8 E4/8 F#4/8 D4/8 F#4/q', 'F4/8 C#4/8 F4/q E4/8 C4/8 E4/q', 'B3/8 C#4/8 D4/8 E4/8 F#4/8 D4/8 F#4/8 B4/8', 'A4/8 F#4/8 D4/8 F#4/8 A4/h']
A2 = [b.replace('3/', '§/').replace('4/', '5/').replace('§/', '4/') for b in A1]
B1 = ['F#4/8 G#4/8 A#4/8 B4/8 C#5/8 A#4/8 C#5/q', 'D5/8 A#4/8 D5/q C#5/8 A#4/8 C#5/q'] * 2
B1[3] = 'D5/8 A#4/8 D5/q C#5/h'
B2 = [b.replace('5/', '6/').replace('4/', '5/') for b in B1]
LA = ['B2/q F#2/q B2/q F#2/q'] * 3 + ['D2/q A2/q D2/q A2/q']
LB = ['F#2/q C#2/q F#2/q C#2/q', 'D2/q A#2/q F#2/q C#2/q'] * 2
rh = A1 + A2 + B1 + B2 + A1 + A2 + B1 + B2 + ['B4/q F#4/q B3/q r/q', '[D4 F#4 B4]/w']
lh = LA * 2 + LB * 2 + LA * 2 + LB * 2 + ['B2/q F#2/q B2/q r/q', '[B2 F#3]/w']
rh[0] = rh[0].replace('B3/8', 'B3/8!pp', 1)
rh[8] = rh[8].replace('F#4/8', 'F#4/8!p', 1)
rh[16] = rh[16].replace('B3/8', 'B3/8!mf', 1)
rh[24] = rh[24].replace('F#4/8', 'F#4/8!cresc', 1)
rh[32] = rh[32].replace('B4/q', 'B4/q!ff', 1)
SONGS['mountain-king'] = {
    "hands": "both", "key": "Bm", "time": "4/4", "tempo": T(84, 56, 132),
    "intro": [{"kind": "text", "title": "In the Hall of the Mountain King", "text": "Grieg, Peer Gynt, 1875. One tune, again and again, getting louder each time: start very soft (pp) and build to very loud (ff). B minor: F♯ and C♯ in the key signature, plus a few naturals."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": "Melody and bass checked against the Mutopia Project edition (Grieg, Op. 46 No. 4, University Society 1918). Arranged for this app.",
}

# Brahms' Lullaby (unlocks at Intermediate 10: intervals)
r, _ = convert(M('LullabyBrahms-C.midi'), bar16=12, beat16=4, pickup16=4, bars=16, rh=1, rh_track=0, lh_track=None)
mel = bars(r['rh'])
mel[12] = 'G4/h C4/8 C4/8'
mel[15] = 'F4/q E4/q D4/q'
mel[16] = 'C4/h E5/8 E5/8'
up = [b.replace('5/', '6/').replace('4/', '5/') for b in mel]
up[16] = 'C5/hd'
rh = mel + up[1:]
CH = {'C': 'C3/q [E3 G3]/q [E3 G3]/q', 'Dm-G': 'D3/q [F3 A3]/q G2/q', 'G7': 'G2/q [F3 B3]/q [F3 B3]/q',
      'C7': 'C3/q [E3 G3]/q [E3 Bb3]/q', 'F': 'F2/q [F3 A3]/q [F3 A3]/q', 'end': 'C3/q G2/q C2/q'}
prog = ['C', 'C', 'C', 'Dm-G', 'Dm-G', 'Dm-G', 'G7', 'C7', 'F', 'C', 'Dm-G', 'C7', 'F', 'C', 'Dm-G', 'C']
lhv = [CH[c] for c in prog]
lh = ['r/q'] + lhv + lhv[:-1] + ['[C2 C3]/hd']
lh[16] = 'C3/q G2/q r/q'
SONGS['brahms-lullaby'] = {
    "hands": "both", "key": "C", "time": "3/4", "pickup": True, "tempo": T(84, 56, 120),
    "intro": [{"kind": "text", "title": "Brahms' Lullaby", "text": "Brahms, 1868. Two verses: the second is an octave higher. The left hand plays a waltz pattern: bass note, then two soft chords."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": "Melody from the Mutopia Project edition (Brahms, Op. 49 No. 4, arr. Diego F. Guillen, public domain). Left hand arranged for this app.",
}

# Eine kleine Nachtmusik (hidden, Intermediate ★★)
r, _ = convert(M('k525-2.midi'), bar16=16, beat16=4, bars=28, rh=2, lh=1, lh_keep='bottom')
rh, lh = bars(r['rh']), bars(r['lh'])
rh[5] = rh[7] = 'G5/8 F#5/8 F#5/qd A5/8 C6/8 F#5/8'
rh[17] = 'G4/h~ G4/8 G4/16 F#4/16 A4/8 F#4/8'
rh[18] = 'B4/h~ B4/8 B4/16 A4/16 C5/8 A4/8'
rh[19] = 'D5/8 D5/8 D5/8 D5/8 E5/8 E5/8 F#5/8 F#5/8'
rh[20] = 'G5/8 G5/8 A5/8 A5/8 B5/8 B5/8 C#6/8 C#6/8'
rh[27] = 'D6/hd r/q'
lh[27] = '[D2 D3]/hd r/q'
SONGS['nachtmusik'] = {
    "hands": "both", "key": "G", "time": "4/4", "tempo": T(96, 60, 132),
    "intro": [{"kind": "text", "title": "Eine kleine Nachtmusik", "text": "Mozart's Serenade K. 525, 1787: the first violin's part in your right hand, the cello's in your left. It starts with a rising “rocket” and ends in D major."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Mozart, K. 525 (violin 1 and cello), public domain"),
}

# Swan Lake: Neapolitan Dance (Advanced 3)
r, _ = convert(M('dansenapolitaine.midi'), bar16=8, beat16=4, bars=36, rh=1, lh=2, rh_track=0, lh_track=[2, 3], flats=True, shift=(-2, 0), lh_keep='bottom')
rh, lh = bars(r['rh']), bars(r['lh'])
rh[35] = 'Eb5/q r/q'
lh[35] = '[Eb2 Eb3]/q r/q'
SONGS['swan-lake'] = {
    "hands": "both", "key": "Eb", "time": "2/4", "tempo": T(72, 48, 104),
    "intro": [{"kind": "text", "title": "Swan Lake: Neapolitan Dance", "text": "Tchaikovsky, 1876, from Act 3 of the ballet. A cornet solo over a strumming accompaniment: the left hand plays a bass note, then quick repeated chords. E♭ major: three flats."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": "Notes from the Mutopia Project arrangement by Laurence Sardain (public domain), melody at concert pitch.",
}

# Canon in D (Advanced 6)
r, _ = convert(M('CanonInD.midi'), bar16=16, beat16=4, bars=32, rh=1, rh_track=0, lh_track=None)
rh = bars(r['rh'])
rh[4] = 'F#4/h A4/h'
for i in range(18, 26):  # the violin's low passage, up an octave for the right hand
    rh[i] = ' '.join(t.replace('3/', '§/').replace('4/', '5/').replace('§/', '4/') if t[0] != 'r' else t for t in rh[i].split())
rh[25] = 'A4/q A4/q B4/q B4/q'
rh = rh[:32] + ['[D4 F#4 D5]/w']
ground = ['D3/h A2/h', 'B2/h F#2/h', 'G2/h D2/h', 'G2/h A2/h']
lh = (ground * 8) + ['[D2 D3]/w']
SONGS['canon-in-d'] = {
    "hands": "both", "key": "D", "time": "4/4", "tempo": T(72, 48, 100),
    "intro": [{"kind": "text", "title": "Canon in D", "text": "Pachelbel, around 1700. The left hand repeats one 4-bar bass line the whole way through (a ground bass) while the right hand's tune keeps changing over it."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": "Melody adapted from Jim Paterson's arrangement (mfiles.co.uk) via the Mutopia Project, CC BY 3.0. Ground bass and piano layout arranged for this app.",
}

# Turkish March (Advanced 9)
r, _ = convert(M('KV331_3_RondoAllaTurca.midi'), bar16=8, beat16=4, pickup16=4, bars=32, rh=2, lh=3, lh_keep='bottom')
rh, lh = bars(r['rh']), bars(r['lh'])
rh[32] = 'A4/q r/q'
lh[32] = '[A2 A3]/q r/q'
SONGS['turkish-march'] = {
    "hands": "both", "key": "Am", "time": "2/4", "pickup": True, "tempo": T(80, 50, 120),
    "intro": [{"kind": "text", "title": "Turkish March", "text": "Mozart, Rondo alla Turca, 1783. Sixteenths that circle a note (B A G♯ A), then marching chords. Practice the first 4 bars slowly with the loop on before playing it through."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Mozart, K. 331 III, typeset by Rune Zedeler and Chris Sawer"),
}

# The Entertainer (Advanced 12)
r, _ = convert(M('entertainer.midi'), bar16=8, beat16=4, bars=36, rh=2, lh=2, lh_keep='outer', spell={10: 'Bb'}, lift=(no_octaves, no_octaves))
rh, lh = bars(r['rh']), bars(r['lh'])
rh[35] = 'C6/q r/q'
lh[35] = 'C3/8 G2/8 C2/q'
SONGS['the-entertainer'] = {
    "hands": "both", "key": "C", "time": "2/4", "tempo": T(72, 44, 100),
    "intro": [{"kind": "text", "title": "The Entertainer", "text": "Scott Joplin, 1902. Ragtime: the left hand “strides” between a low bass note and a chord, while the right hand syncopates against it. Joplin wrote “Not fast”."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Joplin, The Entertainer, typeset by Chris Sawer"),
}

# Maple Leaf Rag (hidden: ★★★ on Advanced 11)
r, _ = convert(M('maple.midi'), bar16=8, beat16=4, pickup16=2, bars=48, rh=2, lh=2, lh_keep='outer', flats=True, lift=(no_octaves, no_octaves))
rh, lh = bars(r['rh']), bars(r['lh'])
rh, lh = rh[0:17] + rh[33:49] + ['[Eb5 Ab5]/q r/q'], lh[0:17] + lh[33:49] + ['Ab2/q r/q']
SONGS['maple-leaf-rag'] = {
    "hands": "both", "key": "Ab", "time": "2/4", "pickup": True, "tempo": T(64, 40, 96),
    "intro": [{"kind": "text", "title": "Maple Leaf Rag", "text": "Scott Joplin, 1899: the A and B strains. A♭ major has four flats. Bars 9–16 climb high on your keyboard, up to A♭6."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Joplin, Maple Leaf Rag, typeset by Chris Sawer"),
}

# Clair de Lune (hidden: Advanced ★★)
r, _ = convert(M('debussy_Ste_Bergamesq_Clair.midi'), bar16=18, beat16=6, bars=26, rh=2, lh=2, rh_keep='top', lh_keep='outer', flats=True, lift=(no_octaves, no_octaves))
rh, lh = bars(r['rh']), bars(r['lh'])
rh += ['[Db5 F5]/hd~ [Db5 F5]/qd']
lh += ['[Db2 Ab2]/hd~ [Db2 Ab2]/qd']
SONGS['clair-de-lune'] = {
    "hands": "both", "key": "Db", "time": "9/8", "tempo": T(40, 28, 56),
    "clefChanges": {"lh": auto_clefs(lh)},
    "intro": [{"kind": "text", "title": "Clair de Lune", "text": "Debussy, 1905: the opening page. 9/8 has three slow beats per bar, each a dotted quarter. The left hand starts in the treble clef: watch for the clef changes. D♭ major has five flats."}],
    "parts": {"rh": join(rh), "lh": join(lh)},
    "credit": credit("Debussy, Suite bergamasque III, typeset by Keith OHara"),
}

for k, v in OUT.items():
    path = os.path.join(root, k + '.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(v, f, indent=2, ensure_ascii=False)
        f.write('\n')
for k, v in SONGS.items():
    with open(os.path.join(root, 'songs', k + '.json'), 'w') as f:
        json.dump(v, f, indent=2, ensure_ascii=False)
        f.write('\n')
print(len(OUT), 'level songs,', len(SONGS), 'songs')
