# learning-piano: Phase 0 plan

Status: **approved.** Phase 0 done (design B chosen, with C's green/red for hit/miss); Phase 1 done.

**Your keyboard:** Casio CTK-2400, 61 keys (36 white + 25 black), C2–C7, no octave-shift button. Calibration still detects the range.

## 1. Architecture

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite 8, vanilla JS (ES modules), `base: '/learning-piano/'` | No framework. |
| PWA / offline | `vite-plugin-pwa` (Workbox) | **Addition, not a swap.** It generates the service worker and the precache list from the build output, so every hashed JS/CSS/font/sample file is cached on first load without a hand-maintained list. Free and MIT. |
| Notation | VexFlow 5 (Bravura font bundled) | Already proven in the mockups: the grand staff renders at iPhone landscape size. |
| Playback / metronome / SFX | Tone.js + Salamander Grand Piano samples | Samples are self-hosted under `public/samples/` (mp3, roughly every 3rd note, ~25 files, ~1.5 MB). They are CC-BY 3.0 (Alexander Holm), so the app will include a credit line. |
| Pitch detection | `pitchy` (McLeod) + my own onset detector | pitchy gives pitch and clarity. Onsets come from an RMS energy rise, which is needed because repeated notes (E-E in Ode to Joy) never change pitch. |
| Storage | IndexedDB (small wrapper I write, no dependency) | Stores: `progress`, `settings`, `calibration`, `songs`. Export/Import saves and loads one JSON file. |
| Routing | Hash router (`#/home`, `#/map`, `#/lesson/noob-09`, …) | Works on GitHub Pages with no 404 tricks. |
| Fonts | Self-hosted via `@fontsource/*` | Bundled and precached, so no Google Fonts requests and the app works offline. |
| Tests | Vitest | Covers scoring, timing windows, pitch→note mapping, the level schema and the XP curve. |
| Screenshots | Playwright, 390×844 and 844×390 | Run at the end of every phase. |
| Deploy | GitHub Actions → GitHub Pages | Runs on push to `main`. |

### File structure

```
learning-piano/
├─ index.html
├─ vite.config.js
├─ public/
│  ├─ icons/                 192, 512, maskable, apple-touch-icon-180
│  └─ samples/salamander/    self-hosted piano samples
├─ src/
│  ├─ main.js                boot, router, rotation guard
│  ├─ router.js
│  ├─ config/
│  │  └─ scoring.js          ← timing windows, star thresholds, XP, combo tiers (ONE file)
│  ├─ core/                  store (pub/sub), db (IndexedDB + export/import), music theory utils, level schema
│  ├─ audio/                 context (tap-to-unlock, resume on foreground), piano, metronome, sfx, mic, pitch
│  ├─ engine/                timeline (level → timed events), scorer (pure functions), lesson state machine
│  ├─ ui/
│  │  ├─ components/         staff strip, keyboard, HUD, XP bar, star row, modal
│  │  ├─ screens/            home, map, lesson, results, calibrate, songs, settings
│  │  └─ styles/             tokens.css (the chosen design), base.css
│  └─ content/
│     ├─ sections.json
│     ├─ levels/{noob,beginner,intermediate,advanced}/NN.json
│     └─ songs/*.json
├─ tests/
└─ .github/workflows/deploy.yml
```

Content lives in `src/content` and loads through `import.meta.glob`, so the precache picks it up automatically. Adding a level means adding a JSON file, with no engine changes.

### Level JSON (draft)

```json
{
  "id": "noob-09",
  "section": "noob",
  "title": "Ode to Joy",
  "type": "song",                       // lesson | drill | song | test
  "intro": [
    { "kind": "text", "text": "Your first real melody…" },
    { "kind": "note-card", "note": "G4", "finger": 5 }
  ],
  "clefs": ["treble"],
  "key": "C", "time": "4/4",
  "tempo": { "default": 72, "min": 40, "max": 100 },
  "hands": "right",
  "parts": {
    "rh": "E4/q:3 E4/q F4/q:4 G4/q:5 | G4/q F4/q E4/q D4/q:2 | C4/q:1 C4/q D4/q E4/q | E4/qd D4/8 D4/h"
  },
  "unlocks": ["song:hot-cross-buns"]
}
```

Notation: `pitch/duration[:finger]`, with `|` as the bar line and `r/q` for a rest. Chords are written as `[C4 E4 G4]/h`. A validator runs in the tests, so a typo in a level fails CI before it reaches you.

Added in Phase 6: triplets `C4/8t` (validated in complete groups), dynamics `C4/q!mf` (`pp p mp mf f ff cresc dim`, used for playback loudness, not scored), 6/8 and 9/8 (clicks on the dotted quarter; tempo counts those beats), `ottava: [{part, from, to, type: "8va"|"8vb"}]` (notes are written at sounding pitch and engraved an octave away), `clefChanges: { lh: [[bar, "treble"], ...] }`, and `generate: {...}` for unseen sight-reading passages.

### iOS audio plan

- One `AudioContext` is created and unlocked on the first tap. It resumes on `visibilitychange`/`pageshow`, and the mic stream is re-acquired if iOS killed it while the app was in the background.
- The mic opens with `echoCancellation`, `noiseSuppression` and `autoGainControl` all **off**, because those filters destroy pitch detection.
- **Known iOS risk:** while the mic is live, Safari can route playback to the quiet earpiece. Mitigation: `navigator.audioSession.type = 'play-and-record'` where supported, and the mic stays closed during the Listen demo. I'll verify this on your phone in Phase 3.
- SFX are muted while the mic is listening and queued to play after the attempt.

## 2. Scoring

All numbers below live in `src/config/scoring.js` and are tunable.

- **Timing windows** (± around each note's target time): Noob 200 ms, Beginner 150 ms, Intermediate 100 ms, Advanced 75 ms. The measured latency from calibration is subtracted first.
- **Per-note judgement:**
  - Right pitch inside the window = hit.
  - Inside the inner 40% of the window = *on time*; the rest of the window = *early* or *late*.
  - Wrong pitch, or outside the window = miss.
- **Accuracy %** = hits ÷ notes.
- **Stars:** ★ 70% · ★★ 85% · ★★★ 95%. One star clears the level and unlocks the next.
- **Section test:** 85% or higher unlocks the next section. Tests use the section's tightest window and have no Listen demo.
- **Combo:** counts consecutive hits. XP multiplier tiers: ×1, ×2 at 10, ×3 at 25, ×4 at 50. A miss resets it.
- **XP:**
  - 10 per attempt, plus 1 per hit × combo multiplier.
  - +30 for each star earned for the first time.
  - +50 for a first clear.
  - Replays always earn something, but grinding one easy level gives less than progressing.
- **Player level:** XP needed for the next level = `150 + 75 × (level − 1)`. It's a gentle curve and tunable.

## 3. Curriculum (draft, refine before Phase 5)

Every level fits inside **C2–C7**, the 61-key range of the CTK-2400; early sections mostly stay within C3–C6. Calibration confirms your actual range. Every new note gets a "meet the note" card: its name, where it sits on the staff and where it is on the keyboard.

**Noob: right hand, treble clef, C position**

| # | Level | # | Level |
|---|---|---|---|
| 1 | The keyboard: black-key groups, find every C *(find-the-key drill)* | 9 | 🎵 Ode to Joy (RH) |
| 2 | Finger numbers + C D E by feel | 10 | A, B and high C: moving the hand |
| 3 | Treble clef: Middle C, D, E on the staff | 11 | Lines & spaces *(find-the-key drill, from the staff)* |
| 4 | F and G: full C position | 12 | Ties and repeat signs |
| 5 | Quarter notes and steady pulse | 13 | 🎵 Twinkle Twinkle (RH) |
| 6 | Half notes | 14 | Below Middle C: B, A, G and ledger lines |
| 7 | Whole notes, bars and 4/4 | 15 | 🎵 Mary Had a Little Lamb |
| 8 | Skips (thirds) | ⚑ | **Noob Test** |

**Beginner: bass clef, left hand, rhythm, first keys**

| # | Level | # | Level |
|---|---|---|---|
| 1 | Bass clef + LH C position, LH finger numbers | 9 | G major: F♯ key signature, G position |
| 2 | Bass clef C–G reading | 10 | F major: B♭ key signature |
| 3 | LH melodies (quarter/half) | 11 | Hands separately: same piece, RH then LH |
| 4 | Bass lines & spaces *(find-the-key drill)* | 12 | 🎵 Aura Lee (hands separately) |
| 5 | Rests: quarter, half, whole | 13 | Grand staff: melody passes between hands |
| 6 | Eighth notes ("1 & 2 &") | 14 | Sight-reading drill in C/G/F |
| 7 | 3/4 time + dotted half *(moved from Advanced)* | 15 | 🎵 Amazing Grace (3/4, hands separately) |
| 8 | Dotted quarter + eighth | ⚑ | **Beginner Test** |

**Intermediate: hands together, accidentals, scales, triads**

| # | Level | # | Level |
|---|---|---|---|
| 1 | Hands together: LH holds, RH moves | 9 | Scales LH + hands together |
| 2 | Hands together: both moving, parallel | 10 | Intervals 2nd–8ve (hear + read) |
| 3 | Contrary motion | 11 | Triads: major/minor, *broken* |
| 4 | Sharps, flats, black-key names, enharmonics | 12 | Block triads I–IV–V *(needs Phase 7)* |
| 5 | Accidentals and naturals within a bar | 13 | Dynamics: p, mp, mf, f, crescendo |
| 6 | D major, B♭ major | 14 | 🎵 Minuet in G (Petzold), simplified |
| 7 | A minor, E minor (natural/harmonic) | 15 | 🎵 Für Elise, opening |
| 8 | One-octave scales, thumb-under (C, G, F) | ⚑ | **Intermediate Test** |

**Advanced: harmony, complex rhythm, independence, real-world reading**

| # | Level | # | Level |
|---|---|---|---|
| 1 | Chord inversions | 9 | 6/8 time *(stays in Advanced)* |
| 2 | Progressions I–IV–V–I, I–V–vi–IV in several keys | 10 | Sight-reading: generated unseen passages |
| 3 | Accompaniment patterns: broken chords, Alberti bass | 11 | Reading 8va / 8vb |
| 4 | More keys: A, E, E♭, A♭ major; D, G minor | 12 | Fit it on 61 keys: adapt 88-key pieces by shifting octaves |
| 5 | 16th notes | 13 | 🎵 Prelude in C (Bach BWV 846), adapted |
| 6 | Syncopation | 14 | 🎵 Gymnopédie No. 1 (Satie), adapted |
| 7 | Triplets *(added)* | 15 | Capstone: learn an unseen piece with the self-study workflow |
| 8 | Hand independence: melody + accompaniment | ⚑ | **Advanced Test** |

**Unlockable song library** (every piece is public domain): Hot Cross Buns, Lightly Row, Jingle Bells (1857), Oh! Susanna (1848), When the Saints, Greensleeves, In the Hall of the Mountain King (Grieg), Brahms' Lullaby, Eine kleine Nachtmusik, Swan Lake: Neapolitan Dance, Canon in D (Pachelbel), Turkish March, Maple Leaf Rag (A and B strains), The Entertainer (intro and A strain), Clair de Lune (opening page). Intermediate/Advanced songs are long versions (32+ bars or about a minute). Scarborough Fair, Morning Mood and the Swan Lake oboe theme were swapped out in Phase 6 because no checkable source was reachable. The hidden ones unlock by earning ★★★ on certain levels, or by clearing a section with every level at ★★ or better.

## 4. Design concepts

Each sheet shows Home and Map (portrait 390×844) plus Lesson and Results (landscape 844×390). They're in `design/phase0/`, with individual screens under `design/phase0/screens/` and mockup sources under `design/mockups/`.

- **A, Engraved:** light paper, sheet-music engraving, serif + mono type. The map is a vertical staff whose nodes follow a melody contour. Pure grayscale: played notes fade and misses get an ✕.
- **B, Stage:** pure black, condensed poster type, glow. The XP bar is a VU meter and the map is a setlist line. Pure grayscale: misses are hatched.
- **C, Grid:** brutalist arcade style with pixel type and hard shadows. The map is a board-game grid. Black & white, plus green and red used **only** for hit and miss.

The lesson layout is the same in all three: a fixed playhead about a third of the way in, music scrolling under it, a sticky clef gutter, and a 36-key keyboard that shows the next key and its finger number.

## 5. Decisions log

- Design: B (Stage) layout, with green/red from C used only for hit/miss.
- Octaves are strict: the right note in the wrong octave is a miss.
- Wrong or extra notes break the combo but do not lower accuracy.
- Section tests can be taken any time; passing one skips the section.
- Curriculum changes approved (3/4 in Beginner, triplets added, dynamics taught but not scored, broken chords until Phase 7).
- Work is pushed straight to `main`; every push deploys to GitHub Pages.
- Practice earns no XP. Levels stay 4–8 bars (songs ~16).
- "Find the key" drills (untimed, first answer counts) for keyboard geography and staff reading.
- Noob and Beginner content is strictly one note at a time so the mic can score it (checked by tests).
- Hands-together levels: Keyboard (mic) mode scores the melody (the top right-hand note wherever notes start together); Taps mode scores every note. Both hands get scored once Phase 7 lands. Left-hand notes the mic hears near their time never break the combo.
- Songs in the later sections are longer versions (32+ bars); ~2-minute pieces are fine in Advanced.
- Song swaps approved: sourced pieces over melodies written from memory.
- Phase 7 order: block chords first, then full two-hand scoring in pieces (e.g. Für Elise).
- Chord scoring: Advanced counts a chord only if every note is right; earlier sections score each note.
- Notes the mic can't separate (an octave, 12th or two octaves above another note of the same chord) aren't scored, and the app says so (instead of risking unfair misses).
- Phase 7 content tweaks: Intermediate 2 plays parallel 10ths (octaves can't be scored), Intermediate 12 block chords are right hand only.
- Using another piano (e.g. acoustic, 88 keys): recalibrate on it; press C2/C7 for the lowest/highest steps.
- Phase 6 sources: Mutopia Project editions converted via LilyPond → MIDI, simplified to ≤2 notes per hand at once and fitted to C2–C7.

## 6. How the mic hears chords (Phase 7)

The one-pitch detector (McLeod) finds when a key is struck and, for single notes, which one. For chords and two-hand playing the app follows the score: when a note or chord is due, it takes an 8192-point spectrum just before and ~130 ms after each possible onset (±window), keeps only what got louder, and explains that rise as a mix of note templates (the expected notes plus a key either side, a whole step and an octave away) with non-negative least squares. A note counts if it carries a real share of the sound, its own overtones are really there, and it beats the neighbouring keys. On simulated piano tone this hears ~97% of chord tones, never credits a left-out note, and credits a wrong key next to the right one about 5% of the time (mostly low bass notes). Real pianos differ; the Mic test's chord check shows how it does on yours.

## 7. Later (after Phase 8)

- **Import your own sheet music:** load a MusicXML file (free from sites like MuseScore or IMSLP transcriptions) and practise it with the same playhead, Listen, slow-practice and scoring tools.
