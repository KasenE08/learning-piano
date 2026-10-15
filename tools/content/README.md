# Content tools

Python scripts that wrote the level and song JSON in `src/content/`.

- `gen.py`: Noob and Beginner levels and their songs (hand-written).
- `levels6.py`: Intermediate and Advanced levels and tests.
- `songs6.py`: Phase 6 songs, converted from Mutopia Project LilyPond sources.
- `midi2tok.py`: MIDI → this app's notation (quantise, one voice per hand, fit C2–C7).

Converting a piece: compile the `.ly` with LilyPond (`pip install lilypond mido`), with
`\unfoldRepeats` in the score and grace notes and staccato marks removed (LilyPond's MIDI
shortens staccato notes), then:

```sh
python tools/content/songs6.py src/content <dir with .midi files>
python tools/content/levels6.py src/content <dir with .midi files>
```
