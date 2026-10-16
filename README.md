# Learning Piano

A free piano-learning PWA: from zero to reading any sheet music on your own.
Vanilla JS + Vite, fully offline, installable on iPhone. No accounts, no backend.

Live: https://KasenE08.github.io/learning-piano/

## How to use it

**Install.** Open the link in Safari on your iPhone, tap Share, then *Add to Home Screen*.
It runs full-screen and works offline after the first visit. When a new version is out, a
*New version ready* banner appears: tap *Update* (or ignore it, it waits).

**Set up your piano.** *You → Pianos*. Your first piano is called "My keyboard" (tap ••• to
rename it). Tap *Calibrate*: about a minute of room noise, your lowest and highest keys, a
loudness check and a timing check. Put the phone 6–12 inches from the keys. Playing more
than one piano (say a Casio at home and an acoustic piano elsewhere)? *Add a piano* and
calibrate it once; switch on the *You* screen or with the *Piano* picker on a lesson's
start card. On an 88-key piano, press C2 and C7 for the lowest and highest keys.

**Learn.** The *Map* runs Noob → Beginner → Intermediate → Advanced. Each level starts with
short cards, then a Listen-through, then a count-in. Play along as the music scrolls under
the playhead: 70% clears a level, 85% and 95% earn more stars. Pass a section test (85%) to
skip ahead. Bonus songs unlock along the way, some hidden.

**Keyboard or Taps.** *Keyboard* listens to your piano through the mic: single notes,
chords and both hands. A note exactly an octave (or 12th, or two octaves) above another
note of the same chord can't be told apart by any microphone, so it isn't scored, and the
results say how many. *Taps* uses the on-screen keys. In Advanced, a chord only counts
if every note is right.

**Practise.** On a lesson, tap *Practice*: slow the tempo, pick bars to loop, play one hand
at a time. Practice doesn't change your stars or XP.

**Check the mic.** *You → Mic test* shows the notes it hears; the *Chord check* lights a
chord's keys and shows which notes it heard.

**Back up.** *You → Export backup* saves progress, settings and every piano's calibration
to a file (Files, iCloud, AirDrop); *Import backup* restores it.

## Develop

```sh
npm install
npm run dev              # http://localhost:5173/learning-piano/  (add ?demo for sample progress)
npm test                 # unit tests (Vitest)
npm run build            # production build into dist/
npm run verify:offline   # build, then prove every screen loads with the network off
npm run verify:update    # install v1, publish v2: the app offers the update and switches on tap
npm run perf             # lesson load time and scroll smoothness at 4× CPU throttle (PERF_PROD=1 for the build)
npm run shots -- <dir>   # iPhone screenshots (390×844 portrait, 844×390 landscape)
npm run e2e:mic -- <dir> # fake-microphone browser tests: calibration, mic test, chord check, scored
                         # lessons with chords and both hands (MIC_ONLY=intermediate-15 runs one)
npm run e2e:levels -- noob beginner intermediate advanced songs
                         # plays every level and song with perfect taps; expects 100%
```

## Layout

- `src/config/scoring.js`: every scoring number (timing windows, stars, XP, combo)
- `src/content/`: curriculum, songs and level files (`levels/<section>/<NN>.json`; notation is documented in `src/engine/notation.js`)
- `src/engine/`: notation parser (triplets, dynamics, 8va/8vb, compound time), scorer, the listen/play run loop, drills and the sight-reading passage generator
- `src/audio/`: Tone.js piano (self-hosted Salamander samples in `public/samples/piano/`), metronome, mic capture (AudioWorklet), analysis (McLeod pitch + band spectral flux), the note detector, the "did this note just start?" check (`salience.js`) and chord detection by template matching (`chords.js`)
- `src/core/`: storage, progress and unlock rules, music helpers, orientation, service worker
- `src/ui/`: design tokens, components (keyboard, staff, dock, sheet), screens
- `PLAN.md`: the overall plan and curriculum

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds, and publishes to
GitHub Pages. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## Credits

Piano samples: Salamander Grand Piano by Alexander Holm (CC-BY 3.0). Notation: VexFlow.
All music is public domain or original.

Many of the Intermediate/Advanced pieces were converted from public-domain editions
in the [Mutopia Project](https://www.mutopiaproject.org) (LilyPond → MIDI → this app's
notation, then simplified to fit 61 keys); each file's `credit` field names its edition.
Canon in D's melody is adapted from Jim Paterson's arrangement (mfiles.co.uk) via Mutopia,
licensed CC BY 3.0.
