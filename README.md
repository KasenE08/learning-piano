# Learning Piano

A free piano-learning PWA: from zero to reading any sheet music on your own.
Vanilla JS + Vite, fully offline, installable on iPhone. No accounts, no backend.

Live: https://KasenE08.github.io/learning-piano/

## Develop

```sh
npm install
npm run dev              # http://localhost:5173/learning-piano/  (add ?demo for sample progress)
npm test                 # unit tests (Vitest)
npm run build            # production build into dist/
npm run verify:offline   # build, then prove every screen loads with the network off
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
