"""Convert a two-staff piano MIDI (from LilyPond) into the app's token notation.

Each hand becomes one voice: notes that start together form a chord, and each
chord lasts until the next onset in that hand (or its own end, then a rest).
Durations are split at bar lines and beat-aligned, joined with ties.
"""
import mido

SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
LO, HI = 36, 96

# 16th-note units -> token duration
DUR = {16: 'w', 14: 'hdd', 12: 'hd', 8: 'h', 7: 'qdd', 6: 'qd', 4: 'q', 3: '8d', 2: '8', 1: '16'}
BASE = {16: 16, 14: 8, 12: 8, 8: 8, 7: 4, 6: 4, 4: 4, 3: 2, 2: 2, 1: 1}


def name(midi, flats=False, spell=None):
    pc = midi % 12
    if spell and pc in spell:
        letter = spell[pc]
        octv = midi // 12 - 1
        # B#/Cb cross the octave line
        if letter.startswith('B#'):
            octv -= 1
        if letter.startswith('Cb'):
            octv += 1
        return f'{letter}{octv}'
    return f'{(FLATS if flats else SHARPS)[pc]}{midi // 12 - 1}'


def read_tracks(path):
    m = mido.MidiFile(path, clip=True)
    tpb = m.ticks_per_beat
    hands = []
    for t in m.tracks:
        now = 0
        on = {}
        notes = []
        for msg in t:
            now += msg.time
            if msg.type == 'note_on' and msg.velocity > 0:
                on.setdefault(msg.note, []).append(now)
            elif msg.type in ('note_off', 'note_on'):
                if on.get(msg.note):
                    s = on[msg.note].pop(0)
                    notes.append((s, now, msg.note))
        if notes:
            hands.append(sorted(notes))
    return tpb, hands


def quantize(notes, tpb, grid=4, start=0, end=None, shift=0):
    """Snap to a 1/grid-of-a-quarter grid; return (start16, end16, midi) relative to `start` (in 16ths)."""
    q = tpb / grid
    out = []
    for s, e, n in notes:
        qs = round(s / q)
        qe = max(qs + 1, round(e / q))
        if qs < start or (end is not None and qs >= end):
            continue
        out.append((qs - start, min(qe, end) - start if end is not None else qe - start, n + shift))
    return out


def fit(midi):
    while midi < LO:
        midi += 12
    while midi > HI:
        midi -= 12
    return midi


def voice(notes, max_notes=2, keep='top', total=None, lift=None):
    """Merge a hand into one chord stream: list of (start, dur, [midis]) with rests as []."""
    by = {}
    for s, e, n in notes:
        by.setdefault(s, []).append((e, n))
    onsets = sorted(by)
    ev = []
    pos = 0
    for i, s in enumerate(onsets):
        if s > pos:
            ev.append((pos, s - pos, []))
        nxt = onsets[i + 1] if i + 1 < len(onsets) else total
        group = by[s]
        end = max(e for e, _ in group)
        if nxt is not None:
            end = min(end, nxt)
        ps = sorted(set(fit(n) for _, n in group))
        if lift:
            ps = lift(ps)
        if len(ps) > max_notes:
            if keep == 'top':
                ps = ps[-max_notes:]
            elif keep == 'bottom':
                ps = ps[:max_notes]
            else:  # outer: bottom + top
                ps = [ps[0]] + ps[-(max_notes - 1):] if max_notes > 1 else [ps[0]]
        ev.append((s, end - s, ps))
        pos = end
    if total is not None and pos < total:
        ev.append((pos, total - pos, []))
    return ev


def split(pos, length, bar, beat, bar_starts):
    """Split a span into allowed durations: at bar lines, then beat-aware greedy."""
    pieces = []
    while length > 0:
        # distance to the next bar line
        nb = next(b for b in bar_starts if b > pos) if any(b > pos for b in bar_starts) else pos + length
        room = min(length, nb - pos)
        p_in_bar = pos - max(b for b in bar_starts if b <= pos)
        chosen = 1
        for d in sorted(DUR, reverse=True):
            if d > room:
                continue
            base = BASE[d]
            start_beat = p_in_bar // beat
            end_beat = (p_in_bar + d - 1) // beat
            within = start_beat == end_beat
            aligned = p_in_bar % min(base, beat) == 0
            synco = d == 4 and beat == 4 and p_in_bar % 2 == 0  # 8 q 8
            if within or aligned or synco:
                chosen = d
                break
        pieces.append((pos, chosen))
        pos += chosen
        length -= chosen
    return pieces


def tokens(events, bar_starts, beat, flats=False, spell=None):
    """events: (start, dur, [midis]); returns a token string with | bar lines."""
    out = []
    for s, d, ps in events:
        parts = split(s, d, None, beat, bar_starts)
        for k, (p, dd) in enumerate(parts):
            dur = DUR[dd]
            if not ps:
                tok = f'r/{dur}'
            else:
                names = [name(x, flats, spell) for x in ps]
                tok = (f'[{" ".join(names)}]' if len(names) > 1 else names[0]) + f'/{dur}'
                if k < len(parts) - 1:
                    tok += '~'
            out.append((p, tok))
    # insert bar lines
    res = []
    for p, tok in out:
        if p in bar_starts and p != 0:
            res.append('|')
        res.append(tok)
    return ' '.join(res)


def convert(path, *, bar16, beat16=4, pickup16=0, first_bar=1, bars=8, rh=2, lh=2, rh_keep='top', lh_keep='outer',
            flats=False, spell=None, grid=4, shift=(0, 0), rh_track=0, lh_track=1, lift=(None, None)):
    """first_bar is 1-based counting full bars after the pickup; bars counts full bars.
    If first_bar == 1 and pickup16, the pickup is included."""
    tpb, hands = read_tracks(path)
    start = pickup16 + (first_bar - 1) * bar16
    with_pickup = first_bar == 1 and pickup16 > 0
    if with_pickup:
        start = 0
    end = pickup16 + (first_bar - 1 + bars) * bar16
    total = end - start
    first_len = pickup16 if with_pickup else bar16
    bar_starts = [0] + [first_len + i * bar16 for i in range(bars)]
    res = {}
    for key, ti, mx, keep, sh, lf in (('rh', rh_track, rh, rh_keep, shift[0], lift[0]), ('lh', lh_track, lh, lh_keep, shift[1], lift[1])):
        if ti is None:
            continue
        src = [n for t in ti for n in hands[t]] if isinstance(ti, (list, tuple)) else hands[ti]
        q = quantize(sorted(src), tpb, grid=4, start=start, end=end, shift=sh)
        ev = voice(q, mx, keep, total, lf)
        res[key] = tokens(ev, bar_starts, beat16, flats, spell)
    return res, with_pickup


def no_octaves(ps):
    """Drop notes doubled an octave higher in the same chord (keeps thirds and sixths)."""
    s = set(ps)
    return [p for p in ps if p + 12 not in s and p + 24 not in s]
