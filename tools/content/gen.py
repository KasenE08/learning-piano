import json, os, sys
root = sys.argv[1]
def T(d, mn, mx): return {"default": d, "min": mn, "max": mx}
def note(n, f, title, text, clef=None):
    c = {"kind": "note", "note": n, "title": title, "text": text}
    if f: c["finger"] = f
    if clef: c["clef"] = clef
    return c
def text(title, t): return {"kind": "text", "title": title, "text": t}
def keys(title, t, hl): return {"kind": "keys", "title": title, "text": t, "highlight": hl}
def rh(s): return {"rh": s}
def lh(s): return {"lh": s}

L = {}
# ---------------- NOOB ----------------
L["noob/01"] = {"type": "find", "show": "name",
  "prompts": ["C4","C5","C4","C3","C5","C4","C3","C5","C4","C3"],
  "hints": {"C4": "middle C", "C5": "the C above middle C", "C3": "the C below middle C"},
  "intro": [
    keys("Black keys come in groups", "Look at the black keys: they repeat in groups of two and three. That pattern is your map of the whole keyboard.", ["C#4","D#4","F#4","G#4","A#4"]),
    keys("C sits left of the two", "Every white key just left of a two-black-key group is a C. They repeat every 12 keys: each one is an octave apart.", ["C3","C4","C5"]),
    keys("Middle C", "Middle C (C4) is the C nearest the middle of your keyboard. On your 61-key Casio it's the 3rd C from the left. The number after the letter tells you which octave.", ["C4"]),
    text("How this drill works", "A C appears on screen. Find it on your keyboard and play it. No rhythm, no rush: only your first answer counts."),
  ]}
L["noob/02"] = {"hands":"right","key":"C","time":"4/4","tempo":T(66,40,96),
  "intro":[text("Finger numbers","Your fingers are numbered 1 to 5: thumb is 1, pinky is 5. The small numbers above the notes tell you which finger to use."),
           note("C4",1,"C, finger 1","Right thumb on middle C."),
           note("D4",2,"D, finger 2","D is the white key between the two black keys."),
           note("E4",3,"E, finger 3","E is just right of the two black keys.")],
  "parts": rh("C4/h:1 D4/h:2 | E4/h:3 D4/h:2 | C4/q:1 D4/q:2 E4/q:3 D4/q:2 | C4/w:1 | E4/q:3 D4/q:2 E4/h:3 | C4/q:1 D4/q:2 C4/h:1")}
L["noob/03"] = {"hands":"right","key":"C","time":"4/4","tempo":T(70,40,100),
  "intro":[text("The treble clef","The curly sign at the start is the treble clef. It's for higher notes, usually your right hand. Each line and space is one white key, stepping up as you go up."),
           note("C4",1,"C on the staff","Middle C sits on its own short line below the staff, a ledger line."),
           note("D4",2,"D on the staff","D hangs just under the bottom line."),
           note("E4",3,"E on the staff","E sits on the bottom line. Line, space, line: one step each.")],
  "parts": rh("E4/q:3 D4/q:2 C4/h:1 | E4/q:3 D4/q:2 C4/h:1 | C4/q:1 C4/q D4/q:2 D4/q | E4/w:3 | C4/q:1 E4/q:3 D4/q:2 E4/q:3 | C4/w:1")}
L["noob/04"] = {"hands":"right","key":"C","time":"4/4","tempo":T(72,40,110),
  "intro":[note("F4",4,"F","F is just left of the three-black-key group. On the staff it's the first space."),
           note("G4",5,"G","G is the next white key up, on the second line. All five fingers now rest on C D E F G: C position.")],
  "parts": rh("C4/q:1 D4/q:2 E4/q:3 F4/q:4 | G4/w:5 | G4/q:5 F4/q:4 E4/q:3 D4/q:2 | C4/w:1 | E4/q:3 F4/q:4 G4/h:5 | F4/q:4 E4/q:3 D4/h:2 | C4/q:1 E4/q:3 G4/q:5 E4/q:3 | C4/w:1")}
L["noob/05"] = {"hands":"right","key":"C","time":"4/4","tempo":T(80,50,120),
  "intro":[text("Quarter notes","A quarter note is one beat: a filled head with a stem. Four fill a bar of 4/4. Count 1, 2, 3, 4 along with the clicks.")],
  "parts": rh("C4/q:1 E4/q:3 G4/q:5 E4/q:3 | D4/q:2 F4/q:4 E4/q:3 D4/q:2 | C4/q:1 D4/q:2 E4/q:3 F4/q:4 | G4/q:5 F4/q:4 E4/q:3 D4/q:2 | E4/q:3 E4/q D4/q:2 D4/q | C4/q:1 E4/q:3 G4/q:5 G4/q | F4/q:4 E4/q:3 D4/q:2 E4/q:3 | C4/q:1 C4/q C4/q C4/q")}
L["noob/06"] = {"hands":"right","key":"C","time":"4/4","tempo":T(84,50,120),
  "intro":[text("Half notes","A half note is a hollow head with a stem. It lasts 2 beats: play it on 1 and keep holding through 2.")],
  "parts": rh("C4/h:1 E4/h:3 | G4/h:5 E4/h:3 | D4/h:2 F4/h:4 | E4/h:3 C4/h:1 | E4/q:3 F4/q:4 G4/h:5 | F4/q:4 E4/q:3 D4/h:2 | E4/h:3 D4/h:2 | C4/h:1 C4/h")}
L["noob/07"] = {"hands":"right","key":"C","time":"4/4","tempo":T(84,50,120),
  "intro":[text("Whole notes","A whole note is a hollow head with no stem: it fills a whole bar of 4 beats."),
           text("Bars and 4/4","Bar lines split music into bars. The 4/4 at the start means 4 beats in every bar, each a quarter note.")],
  "parts": rh("C4/w:1 | E4/w:3 | G4/w:5 | E4/h:3 D4/h:2 | C4/q:1 D4/q:2 E4/q:3 F4/q:4 | G4/w:5 | F4/h:4 D4/h:2 | C4/w:1")}
L["noob/08"] = {"hands":"right","key":"C","time":"4/4","tempo":T(84,50,120),
  "intro":[text("Skips","A skip jumps over one key: C to E, D to F, E to G. On the staff a skip goes line to line or space to space.")],
  "parts": rh("C4/q:1 E4/q:3 D4/q:2 F4/q:4 | E4/q:3 G4/q:5 E4/h:3 | G4/q:5 E4/q:3 F4/q:4 D4/q:2 | E4/q:3 C4/q:1 E4/h:3 | C4/q:1 E4/q:3 G4/h:5 | G4/q:5 E4/q:3 C4/h:1 | D4/q:2 F4/q:4 E4/q:3 D4/q:2 | C4/w:1")}
L["noob/09"] = {"hands":"right","key":"C","time":"4/4","tempo":T(80,50,120),
  "intro":[text("Ode to Joy","Beethoven's melody from his Ninth Symphony (1824). It uses only C position. In bar 4, the dotted note lasts a beat and a half: hold it a bit longer before the short D.")],
  "parts": rh("E4/q:3 E4/q F4/q:4 G4/q:5 | G4/q F4/q:4 E4/q:3 D4/q:2 | C4/q:1 C4/q D4/q:2 E4/q:3 | E4/qd:3 D4/8:2 D4/h | E4/q:3 E4/q F4/q:4 G4/q:5 | G4/q F4/q:4 E4/q:3 D4/q:2 | C4/q:1 C4/q D4/q:2 E4/q:3 | D4/qd:2 C4/8:1 C4/h")}
L["noob/10"] = {"hands":"right","key":"C","time":"4/4","tempo":T(80,50,120),
  "intro":[text("Moving the hand","Slide your hand up so your thumb sits on G. Now your fingers cover G A B C D: G position."),
           note("A4",2,"A","A sits in the second space of the staff."),
           note("B4",3,"B","B is on the middle line."),
           note("C5",4,"High C","The C above middle C, in the third space.")],
  "parts": rh("G4/q:1 A4/q:2 B4/q:3 C5/q:4 | B4/h:3 A4/h:2 | G4/q:1 B4/q:3 A4/q:2 C5/q:4 | B4/w:3 | C5/q:4 B4/q:3 A4/q:2 G4/q:1 | A4/q:2 B4/q:3 C5/h:4 | B4/q:3 A4/q:2 G4/q:1 A4/q:2 | G4/w:1")}
L["noob/11"] = {"type":"find","show":"staff","clef":"treble",
  "prompts":["E4","G4","F4","B4","A4","D5","C5","F5","E5","G4","E4","B4","F4","D5","A4","C5","F5","E5"],
  "intro":[text("Lines","The five lines, bottom to top, are E G B D F: Every Good Boy Does Fine."),
           text("Spaces","The four spaces spell F A C E, bottom to top."),
           text("How this drill works","A note appears on the staff. Name it in your head, find the key and play it. Only your first answer counts.")]}
L["noob/12"] = {"hands":"right","key":"C","time":"4/4","tempo":T(84,50,120),"repeat":True,
  "intro":[text("Ties","A curved line joining two notes of the same pitch is a tie: play the first, and keep holding through the second."),
           text("Repeat signs","The double bar with two dots means repeat: when you reach it, go back to the start sign and play it all again.")],
  "parts": rh("C4/q:1 E4/q:3 G4/h:5~ | G4/h F4/q:4 E4/q:3 | D4/q:2 F4/q:4 E4/h:3~ | E4/q D4/q:2 C4/h:1")}
L["noob/13"] = {"hands":"right","key":"C","time":"4/4","tempo":T(96,60,130),
  "intro":[text("Twinkle Twinkle","A French folk melody from the 1700s, famous from Mozart's variations. Your hand stretches: finger 5 reaches up to A, then the hand settles back into C position.")],
  "parts": rh("C4/q:1 C4/q G4/q:4 G4/q | A4/q:5 A4/q G4/h:4 | F4/q:4 F4/q E4/q:3 E4/q | D4/q:2 D4/q C4/h:1 | G4/q:5 G4/q F4/q:4 F4/q | E4/q:3 E4/q D4/h:2 | G4/q:5 G4/q F4/q:4 F4/q | E4/q:3 E4/q D4/h:2 | C4/q:1 C4/q G4/q:4 G4/q | A4/q:5 A4/q G4/h:4 | F4/q:4 F4/q E4/q:3 E4/q | D4/q:2 D4/q C4/h:1")}
L["noob/14"] = {"hands":"right","key":"C","time":"4/4","tempo":T(76,50,110),
  "intro":[text("Below middle C","Notes below middle C hang under the staff on extra ledger lines. Move your thumb down to G: G A B C D."),
           note("B3",3,"B","B sits just under middle C's ledger line."),
           note("A3",2,"A","A sits on a second ledger line."),
           note("G3",1,"G","G hangs below the second ledger line.")],
  "parts": rh("D4/q:5 C4/q:4 B3/q:3 A3/q:2 | G3/w:1 | A3/q:2 B3/q:3 C4/q:4 D4/q:5 | C4/h:4 B3/h:3 | A3/q:2 C4/q:4 B3/q:3 A3/q:2 | G3/h:1 B3/h:3 | D4/q:5 B3/q:3 A3/q:2 B3/q:3 | G3/w:1")}
L["noob/15"] = {"hands":"right","key":"C","time":"4/4","tempo":T(100,60,140),
  "intro":[text("Mary Had a Little Lamb","An American nursery tune from 1830. Back in C position. Watch the repeated notes: play each one again, don't just hold.")],
  "parts": rh("E4/q:3 D4/q:2 C4/q:1 D4/q:2 | E4/q:3 E4/q E4/h | D4/q:2 D4/q D4/h | E4/q:3 G4/q:5 G4/h | E4/q:3 D4/q:2 C4/q:1 D4/q:2 | E4/q:3 E4/q E4/q E4/q | D4/q:2 D4/q E4/q:3 D4/q:2 | C4/w:1")}
L["noob/test"] = {"hands":"right","key":"C","time":"4/4","tempo":T(84,84,84),
  "parts": rh("C4/q:1 D4/q:2 E4/q:3 F4/q:4 | G4/h:5 E4/h:3 | D4/q:2 F4/q:4 E4/q:3 D4/q:2 | C4/w:1 | G4/q:1 A4/q:2 B4/q:3 C5/q:4 | B4/h:3 G4/h:1 | A4/q:2 C5/q:4 B4/q:3 A4/q:2 | G4/w:1 | D4/q:5 C4/q:4 B3/q:3 A3/q:2 | G3/h:1 B3/h:3 | C4/h:4 D4/h:5~ | D4/q C4/q:4 B3/q:3 C4/q:4")}

# ---------------- BEGINNER ----------------
L["beginner/01"] = {"hands":"left","key":"C","time":"4/4","tempo":T(70,40,100),
  "intro":[text("The bass clef","This is the bass clef, for lower notes, usually your left hand. Its two dots wrap around the F line (F3)."),
           text("Left-hand fingers","The left hand is numbered the same way: thumb 1, pinky 5. In C position your left pinky is on C3, the C below middle C."),
           note("C3",5,"C","C3 is in the second space from the top.", "bass"),
           note("D3",4,"D","D3 is on the middle line.", "bass"),
           note("E3",3,"E","E3 is in the space above the middle line.", "bass")],
  "parts": lh("C3/q:5 D3/q:4 E3/q:3 D3/q:4 | C3/w:5 | E3/q:3 D3/q:4 C3/h:5 | E3/q:3 E3/q D3/h:4 | C3/q:5 E3/q:3 D3/q:4 E3/q:3 | C3/w:5")}
L["beginner/02"] = {"hands":"left","key":"C","time":"4/4","tempo":T(72,40,110),
  "intro":[note("F3",2,"F","F3 is on the fourth line: the one between the clef's dots.","bass"),
           note("G3",1,"G","G3 is in the top space, under your left thumb.","bass")],
  "parts": lh("C3/q:5 D3/q:4 E3/q:3 F3/q:2 | G3/w:1 | G3/q:1 F3/q:2 E3/q:3 D3/q:4 | C3/w:5 | C3/q:5 E3/q:3 G3/h:1 | F3/q:2 D3/q:4 E3/h:3 | G3/q:1 E3/q:3 D3/q:4 F3/q:2 | C3/w:5")}
L["beginner/03"] = {"hands":"left","key":"C","time":"4/4","tempo":T(80,50,120),
  "intro":[text("Left-hand melodies","Ode to Joy again, now with your left hand an octave lower. Keep the beat steady; the left hand often feels slower at first.")],
  "parts": lh("E3/q:3 E3/q F3/q:2 G3/q:1 | G3/q:1 F3/q:2 E3/q:3 D3/q:4 | C3/q:5 C3/q D3/q:4 E3/q:3 | E3/h:3 D3/h:4 | E3/q:3 E3/q F3/q:2 G3/q:1 | G3/q:1 F3/q:2 E3/q:3 D3/q:4 | C3/q:5 C3/q D3/q:4 E3/q:3 | D3/h:4 C3/h:5")}
L["beginner/04"] = {"type":"find","show":"staff","clef":"bass",
  "prompts":["G2","B2","A2","D3","C3","F3","E3","A3","G3","B2","G2","D3","A2","F3","C3","A3","E3","G3"],
  "intro":[text("Bass lines","The bass clef's lines, bottom to top, are G B D F A: Good Boys Do Fine Always."),
           text("Bass spaces","The spaces, bottom to top, are A C E G: All Cows Eat Grass."),
           text("How this drill works","A note appears on the bass staff. Find it and play it. Only your first answer counts.")]}
L["beginner/05"] = {"hands":"right","key":"C","time":"4/4","tempo":T(84,50,120),
  "intro":[text("Rests","A rest is a beat of silence: lift your hand, but keep counting. A quarter rest is a squiggle (1 beat), a half rest sits on the middle line (2 beats), a whole rest hangs below it (a whole bar).")],
  "parts": rh("C4/q:1 r/q E4/q:3 r/q | G4/h:5 r/h | E4/q:3 D4/q:2 C4/q:1 r/q | r/w | G4/q:5 F4/q:4 E4/q:3 r/q | D4/h:2 r/h | C4/q:1 E4/q:3 G4/q:5 r/q | C4/h:1 r/h")}
L["beginner/06"] = {"hands":"right","key":"C","time":"4/4","tempo":T(72,50,110),
  "intro":[text("Eighth notes","An eighth note is half a beat; two fit in one beat, often joined by a beam. Count “1 & 2 & 3 & 4 &”: the number on the click, the “&” halfway between.")],
  "parts": rh("C4/8:1 D4/8:2 E4/8:3 F4/8:4 G4/h:5 | G4/8:5 F4/8:4 E4/8:3 D4/8:2 C4/h:1 | E4/q:3 E4/8 F4/8:4 G4/q:5 G4/q | F4/8:4 E4/8:3 D4/8:2 E4/8:3 C4/h:1 | C4/8:1 E4/8:3 G4/8:5 E4/8:3 C4/q:1 r/q | D4/8:2 F4/8:4 E4/8:3 D4/8:2 C4/h:1")}
L["beginner/07"] = {"hands":"right","key":"C","time":"3/4","tempo":T(90,60,130),
  "intro":[text("Three-four time","3/4 means 3 beats in a bar: count 1 2 3, 1 2 3, leaning on the 1. It's the waltz feel."),
           text("Dotted half notes","A dot adds half the note's length. A dotted half note lasts 3 beats: a whole bar in 3/4.")],
  "parts": rh("C4/q:1 E4/q:3 G4/q:5 | G4/hd:5 | F4/q:4 E4/q:3 D4/q:2 | E4/hd:3 | C4/q:1 D4/q:2 E4/q:3 | F4/h:4 E4/q:3 | D4/q:2 E4/q:3 D4/q:2 | C4/hd:1")}
L["beginner/08"] = {"hands":"right","key":"C","time":"4/4","tempo":T(80,50,110),
  "intro":[text("Dotted rhythms","A dotted quarter lasts a beat and a half, so the eighth after it lands on the “&” of beat 2: long, short. Count “1 (2) & 3 4”.")],
  "parts": rh("C4/qd:1 D4/8:2 E4/h:3 | E4/qd:3 F4/8:4 G4/h:5 | G4/qd:5 F4/8:4 E4/q:3 D4/q:2 | C4/w:1 | E4/qd:3 D4/8:2 C4/q:1 E4/q:3 | D4/qd:2 E4/8:3 D4/h:2 | C4/qd:1 D4/8:2 E4/q:3 G4/q:5 | C4/w:1")}
L["beginner/09"] = {"hands":"right","key":"G","time":"4/4","tempo":T(84,50,120),
  "intro":[text("Key signatures","The sharp right after the clef is the key signature: every F in the piece is played as F sharp (F#), the black key just right of F."),
           note("F#4",3,"F sharp","Put your thumb on D: D E F# G A. Finger 3 plays F#, the black key.")],
  "parts": rh("G4/q:4 F#4/q:3 E4/q:2 D4/q:1 | E4/q:2 F#4/q:3 G4/h:4 | A4/q:5 G4/q:4 F#4/q:3 E4/q:2 | D4/w:1 | D4/q:1 F#4/q:3 A4/h:5 | G4/q:4 F#4/q:3 E4/h:2 | F#4/q:3 E4/q:2 D4/q:1 F#4/q:3 | G4/w:4")}
L["beginner/10"] = {"hands":"right","key":"F","time":"4/4","tempo":T(84,50,120),
  "intro":[text("One flat","This key signature has one flat: every B is played as B flat (B♭), the black key just left of B."),
           note("Bb4",4,"B flat","Thumb on F: F G A B♭ C. Finger 4 plays B♭, the black key.")],
  "parts": rh("F4/q:1 G4/q:2 A4/q:3 Bb4/q:4 | C5/h:5 A4/h:3 | Bb4/q:4 A4/q:3 G4/q:2 F4/q:1 | G4/w:2 | A4/q:3 Bb4/q:4 C5/q:5 A4/q:3 | G4/q:2 A4/q:3 F4/h:1 | C5/q:5 Bb4/q:4 A4/q:3 G4/q:2 | F4/w:1")}
L["beginner/11"] = {"hands":"both","key":"C","time":"4/4","tempo":T(80,50,120),
  "intro":[text("Hands separately","One piece, two parts. The right hand plays a phrase on the top staff; the left hand answers with the same phrase an octave lower on the bottom staff. Only one hand plays at a time.")],
  "parts": {"rh": "C4/q:1 D4/q:2 E4/q:3 C4/q:1 | r/w | E4/q:3 F4/q:4 G4/h:5 | r/w | G4/q:5 F4/q:4 E4/q:3 D4/q:2 | r/w | C4/w:1 | r/w",
            "lh": "r/w | C3/q:5 D3/q:4 E3/q:3 C3/q:5 | r/w | E3/q:3 F3/q:2 G3/h:1 | r/w | G3/q:1 F3/q:2 E3/q:3 D3/q:4 | r/w | C3/w:5"}}
L["beginner/12"] = {"hands":"both","key":"C","time":"4/4","tempo":T(84,50,120),
  "intro":[text("Aura Lee","A love song from 1861 (later the tune of “Love Me Tender”). The right hand starts in G position; the left hand answers an octave and a half lower, then takes the middle section.")],
  "parts": {"rh": "G4/q:1 C5/q:4 B4/q:3 C5/q:4 | D5/q:5 A4/q:2 D5/h:5 | C5/q:4 B4/q:3 A4/q:2 B4/q:3 | C5/w:4 | r/w | r/w | r/w | r/w | r/w | r/w | r/w | r/w | G4/q:1 C5/q:4 B4/q:3 C5/q:4 | D5/q:5 A4/q:2 D5/h:5 | C5/q:4 B4/q:3 A4/q:2 B4/q:3 | C5/w:4",
            "lh": "r/w | r/w | r/w | r/w | G2/q:5 C3/q:2 B2/q:3 C3/q:2 | D3/q:1 A2/q:4 D3/h:1 | C3/q:2 B2/q:3 A2/q:4 B2/q:3 | C3/w:2 | E3/q:3 E3/q E3/h | E3/q E3/q E3/h | E3/q:3 D3/q:4 C3/q:5 D3/q:4 | E3/w:3 | r/w | r/w | r/w | r/w"}}
L["beginner/13"] = {"hands":"both","key":"C","time":"4/4","tempo":T(76,50,110),
  "intro":[text("The grand staff","Treble staff on top for the right hand, bass staff below for the left, joined by a brace. Middle C sits between them. Here the melody passes from hand to hand, sometimes mid-bar.")],
  "parts": {"rh": "C4/q:1 D4/q:2 E4/q:3 F4/q:4 | r/h G4/h:5 | E4/q:3 C4/q:1 r/h | r/w | E4/q:3 G4/q:5 r/h | r/h D4/q:2 E4/q:3 | C4/w:1 | r/w",
            "lh": "r/w | G3/q:1 F3/q:2 r/h | r/h G3/q:1 E3/q:3 | C3/q:5 D3/q:4 E3/q:3 F3/q:2 | r/h G3/q:1 E3/q:3 | C3/q:5 D3/q:4 r/h | r/w | C3/w:5"}}
L["beginner/14"] = {"hands":"right","key":"G","time":"4/4","tempo":T(76,76,100),"noListen":True,"showFingers":False,
  "intro":[text("Sight-reading","No listening first: read it cold. Before you start, look at the key signature (one sharp: F#), the time signature, and the highest and lowest notes. Then keep going, even after a mistake.")],
  "parts": rh("G4/q E4/q D4/q E4/q | F#4/h G4/h | A4/q G4/q F#4/q E4/q | D4/w | B4/q A4/q G4/q F#4/q | E4/h D4/h | E4/q F#4/q G4/q A4/q | G4/w")}
L["beginner/15"] = {"hands":"both","key":"C","time":"3/4","tempo":T(80,50,110),"pickup":True,
  "intro":[text("Amazing Grace","The hymn tune “New Britain” (1829). It starts with a pickup: one beat before the first full bar. The right hand plays the first half; the left hand plays the second half two octaves lower.")],
  "parts": {"rh": "G4/q:1 | C5/h:3 E5/8:5 C5/8:3 | E5/h:5 D5/q:4 | C5/h:3 A4/q:2 | G4/h:1 G4/q | C5/h:3 E5/8:5 C5/8:3 | E5/h:5 D5/q:4 | G5/hd:5 | r/hd | r/hd | r/hd | r/hd | r/hd | r/hd | r/hd | r/hd",
            "lh": "r/q | r/hd | r/hd | r/hd | r/hd | r/hd | r/hd | r/hd | G3/h:1 E3/q:3 | G3/h:1 E3/8:3 C3/8:5 | E3/h:3 D3/q:4 | C3/h:5 A2/q:2 | G2/h:3 G2/q | C3/h:5 E3/8:3 C3/8:5 | E3/h:3 D3/q:4 | C3/hd:5"}}
L["beginner/test"] = {"hands":"both","key":"C","time":"4/4","tempo":T(80,80,80),
  "parts": {"rh": "C4/q E4/q G4/q r/q | E4/qd D4/8 C4/h | r/w | r/w | G4/8 F4/8 E4/8 D4/8 C4/q r/q | r/w | E4/q F4/q G4/h | r/w | C4/w",
            "lh": "r/w | r/w | C3/q E3/q G3/q r/q | G3/qd F3/8 E3/h | r/w | G2/q B2/q D3/q B2/q | r/w | G3/8 F3/8 E3/8 D3/8 C3/h | r/w"}}

# ---------------- SONGS (rewards) ----------------
S = {}
S["jingle-bells"] = {"hands":"right","key":"C","time":"4/4","tempo":T(108,60,140),
  "parts": rh("E4/q:3 E4/q E4/h | E4/q E4/q E4/h | E4/q:3 G4/q:5 C4/qd:1 D4/8:2 | E4/w:3 | F4/q:4 F4/q F4/qd F4/8 | F4/q E4/q:3 E4/q E4/8 E4/8 | E4/q D4/q:2 D4/q E4/q:3 | D4/h:2 G4/h:5 | E4/q:3 E4/q E4/h | E4/q E4/q E4/h | E4/q:3 G4/q:5 C4/qd:1 D4/8:2 | E4/w:3 | F4/q:4 F4/q F4/qd F4/8 | F4/q E4/q:3 E4/q E4/8 E4/8 | G4/q:5 G4/q F4/q:4 D4/q:2 | C4/w:1")}
S["oh-susanna"] = {"hands":"right","key":"C","time":"4/4","tempo":T(96,60,130),"pickup":True,
  "parts": rh("C4/8:1 D4/8:2 | E4/q:3 G4/q:5 G4/qd A4/8 | G4/q:4 E4/q:2 C4/qd:1 D4/8:2 | E4/q:3 E4/q D4/q:2 C4/q:1 | D4/h:2 r/q C4/8:1 D4/8:2 | E4/q:3 G4/q:5 G4/qd A4/8 | G4/q:4 E4/q:2 C4/qd:1 D4/8:2 | E4/q:3 E4/q D4/q:2 D4/q | C4/hd:1 r/q")}
S["when-the-saints"] = {"hands":"right","key":"C","time":"4/4","tempo":T(110,70,150),
  "parts": rh("r/q C4/q:1 E4/q:3 F4/q:4 | G4/w:5 | r/q C4/q:1 E4/q:3 F4/q:4 | G4/w:5 | r/q C4/q:1 E4/q:3 F4/q:4 | G4/h:5 E4/h:3 | C4/h:1 E4/h:3 | D4/w:2 | r/q E4/q:3 E4/q D4/q:2 | C4/hd:1 C4/q | E4/h:3 G4/h:5 | G4/q F4/hd:4 | r/q E4/q:3 F4/q:4 G4/q:5 | E4/h:3 C4/h:1 | D4/h:2 C4/h:1 | C4/w")}
S["greensleeves"] = {"hands":"right","key":"C","time":"3/4","tempo":T(96,60,130),"pickup":True,
  "parts": rh("A4/q:1 | C5/h:3 D5/q:4 | E5/qd:5 F5/8 E5/q | D5/h:4 B4/q:2 | G4/qd:1 A4/8:2 B4/q:3 | C5/h:4 A4/q:2 | A4/qd:2 G4/8:1 A4/q:2 | B4/h:3 G4/q:1 | E4/hd:1 | A4/q:1 C5/q:3 D5/q:4 | E5/qd:5 F5/8 E5/q | D5/h:4 B4/q:2 | G4/qd:1 A4/8:2 B4/q:3 | C5/qd:4 B4/8:3 A4/q:2 | B4/qd:3 A4/8:2 B4/q:3 | A4/hd:2")}

for k, v in L.items():
    path = os.path.join(root, 'levels', k + '.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(v, open(path, 'w'), indent=2, ensure_ascii=False); open(path, 'a').write('\n')
for k, v in S.items():
    path = os.path.join(root, 'songs', k + '.json')
    json.dump(v, open(path, 'w'), indent=2, ensure_ascii=False); open(path, 'a').write('\n')
print(len(L), 'levels/tests,', len(S), 'songs')
