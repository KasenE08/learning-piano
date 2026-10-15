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
npm run e2e:mic -- <dir> # fake-microphone browser tests: calibration, mic test, a scored lesson
```

## Layout

- `src/config/scoring.js`: every scoring number (timing windows, stars, XP, combo)
- `src/content/`: curriculum, songs and level files (`levels/<section>/<NN>.json`; notation is documented in `src/engine/notation.js`)
- `src/engine/`: notation parser, scorer, and the listen/play run loop
- `src/audio/`: Tone.js piano (self-hosted Salamander samples in `public/samples/piano/`), metronome, mic capture (AudioWorklet), analysis (McLeod pitch + band spectral flux) and the note detector
- `src/core/`: storage, progress and unlock rules, music helpers, orientation, service worker
- `src/ui/`: design tokens, components (keyboard, staff, dock, sheet), screens
- `PLAN.md`: the overall plan and curriculum

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds, and publishes to
GitHub Pages. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## Credits

Piano samples: Salamander Grand Piano by Alexander Holm (CC-BY 3.0). Notation: VexFlow.
All music is public domain or original.
