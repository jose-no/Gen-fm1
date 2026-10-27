# Gen-FM1 manual

Gen-FM1 turns the FM-1 into four generative tracks that play together in one key. This manual covers the generator's controls on the web page. Everything else on the FM-1 (the panel, the screen, the SEQ page, MIDI in) works as in [Felucca](https://github.com/hugelton/Felucca/wiki).

## Getting started

1. Press **Switch on** on the FM-1 picture. The firmware boots as it would on the device.
2. Press **On** in the Generator panel. This sets up the four tracks: each gets an FM sound, a one-bar pattern of sixteenth notes, and its role.
3. Press **Play**. The FM-1's own PLAY button works too.
4. Change anything while it plays. Changes take effect from the next step.

Turning the generator off stops it writing; the patterns it last wrote stay and play like any Felucca pattern.

## How it works

One **harmony engine** holds the key, the scale and a **progression loop** of 2 to 8 chords. The chords are built from the scale by stacking every other note (a triad), so they always fit the scale, whatever it is.

The **master** moves to the next chord in the loop at the master rate. Each track moves through the same loop at the master rate times its own **chord rate** multiplier. A track at ×2 changes chord half as often as the master, so it falls behind and meets the master again at the start of each second pass. With **harmony lock** on, a track ignores its multiplier and always plays the master chord.

Each pass of the master over the loop is a chance to change it: **mutation** sets how many chords are drawn again.

Every step of every track also keeps its own random decision (whether it plays, which chord tone, where the melody goes). Mutation is the chance that a decision is drawn again each time the step comes round. That gives the music memory: at low mutation a phrase repeats and slowly evolves, at high mutation it keeps changing.

The generator writes each step into the track's Felucca pattern just before the sequencer reaches it. Press SEQ on the FM-1 to watch the patterns being written.

## Global controls

| Control | Range | What it does |
| --- | --- | --- |
| Tempo | 40–240 BPM | The tempo, shared with the FM-1's own |
| Key | C to B | The root note of the scale |
| Scale | 16 built in, or Custom | The notes the chords and melody use |
| Progression | 8 sources | How the chord loop is made (below) |
| Preset | 6 progressions | The progression used by Fixed and Pendulum |
| Chords | 2–8 | How many chords are in the loop |
| Master rate | ½ bar to 32 bars | How long the master stays on each chord. Includes 3, 5, 7, 12 and 24 bars |
| Dyad B | Independent, Merge, Call and response | How the two dyad tracks relate (below) |
| Mutation | 0–100 | How much the patterns and the loop change each time round |
| Drift (all tracks) | 0–100 | Adds drift to every track, on top of each track's own (below) |
| Swing (all tracks) | 0–100 | Swing for every track, added to each track's own. At 100 every second sixteenth lands 0.4 of a step late |
| Macro | −100 to +100 | One knob that pushes every track's density up or down, each by its own macro weight. MIDI CC 16 on any channel turns it (64 is the centre). Double-click the slider to centre it |
| New progression | button | Draws a whole new loop now |

### Scales

Built in: Chromatic, Major, Natural minor, Dorian, Mixolydian, Major pentatonic, Minor pentatonic, Harmonic minor, Phrygian, Lydian, Locrian, Melodic minor, Blues, Whole tone, and the two diminished scales.

**Custom:** choose Custom and a row of 12 note buttons appears, starting from the key's root. Tap notes to add or remove them. The root is always included. Scales of any size work: with 5 notes the chords are built from every other note of those 5.

### Progression sources

| Source | How it chooses the next chord |
| --- | --- |
| Fixed | Plays the chosen preset. Mutation occasionally swaps a chord for one a third away |
| Random walk | Moves up or down one or two scale steps |
| Weighted rules | Follows a table of likely chord moves in a major key (V tends to I, ii to V, and so on). Other scale sizes use the random walk |
| Functional harmony | Cycles tonic, then predominant, then dominant, picking a chord from each group |
| Circle of fifths | Steps down a fifth each time (I, IV, vii, iii, vi, ii, V, I in a major scale) |
| Voice-leading | Moves a third up or down, so each chord shares two notes with the last |
| Pendulum | Plays the preset forward, then back (I V vi IV vi V) |
| Pedal | Random walk over a bass that stays on the root |

Presets: I–V–vi–IV, ii–V–I–I, vi–IV–I–V, I–vi–IV–V, i–VII–VI–VII, and I–IV–I–V. In a minor scale the same degrees give the minor-key versions.

### Dyad B modes

- **Independent:** each dyad track uses its own interval, rhythm and chord rate.
- **Merge with A:** A plays the chord's root and third, and B plays its fifth and seventh in A's rhythm, so together they make a four-note chord.
- **Call and response:** B uses its own settings but only plays where A is silent.

## Track controls

Every track has these:

| Control | What it does |
| --- | --- |
| Sound | The FM patch: Tine EP, Bell, FM Bass, Brass, Pad, Marimba, Organ or Pluck |
| Length | How many steps the track's pattern has, 1 to 16 sixteenth notes. Tracks of different lengths drift against each other (polymeter); the chords still change in bars |
| Chord rate | The track's multiplier of the master rate: ×¼, ×½, ×1, ×2, ×3, ×4 or ×8 |
| Harmony lock | Follow the master chord exactly; the chord rate is ignored |
| Octave | Shift the track up or down by up to two octaves |
| Output | Synth + MIDI, Synth only, or MIDI only |
| Density | How busy the track is |
| Density mod | Moves the density over time: Off, Sine, Triangle, Ramp up, Ramp down, Square, Random (a new value each period) or Drift (random, gliding between values) |
| Mod rate | How long one cycle of the density mod takes, ¼ bar to 32 bars, in time with the music |
| Mod depth | How far the mod moves the density, −100 to +100. Negative values turn the shape upside down. The meter shows the density in use right now |
| Macro weight | How much, and which way, the macro moves this track's density, −100 to +100. At 100 the macro's full swing moves the density by 100; a negative weight thins the track as the macro rises |
| Chance | 1–100 %. Each note this track writes plays only at this chance, rolled every time the step comes round, so even a frozen pattern never repeats exactly. At 100 % every note plays |
| Drift | 0–100. Each note lands a little early or a little late, by a new random amount every time it plays: most land near the grid, a few further out. At 100 a note can move up to 7/16 of a step either way. The global drift is added to this |
| Swing | 0–100. Delays every second sixteenth of this track, added to the global swing (together at most 100). Unlike drift it is the same every bar |
| Freeze | Stop writing this track: its current bar loops as it is, through chord changes too. Chance and drift still apply |
| Mute | Silence the track; it keeps running underneath |

The card header shows the track's MIDI channel and the chord it is playing now. The strip under it shows which step of the pattern is playing.

### Dyad A and Dyad B

**Interval:**
- **3rds:** the chord's root and third.
- **5ths:** the root and fifth.
- **6ths:** the third, with the root an octave above.
- **Auto (voice-led):** whichever pair of chord tones is nearest the last pair, so the line moves smoothly.

**Rhythm:**
- **Sustain:** holds the dyad, restarting it on each chord change and bar. Higher density restarts it on half and quarter bars too.
- **Pulse:** short repeated chords, every half bar, quarter or eighth as density rises.
- **Arpeggio:** plays the two notes one at a time, alternating.
- **Euclidean:** spreads a number of hits as evenly as possible over the bar. Density sets how many (1 to 16).

### Bass

**Pattern:**
- **Root:** the chord's root.
- **Root and 5th:** the root, with fifths in between.
- **Walking:** chord tones, with the last notes before a chord change stepping toward the next chord's root.
- **Octaves:** the root, jumping between two octaves.

Density sets how many notes per bar. The bass always plays on the first step of a bar and on every chord change. It starts with harmony lock on, so it marks the master's chords.

### Melody

**Note pool:**
- **Chord tones:** only notes of the current chord.
- **Scale:** any note of the scale.
- **Passing tones:** chord tones on the beats, scale notes between them.

The melody remembers its shape relative to the chord, so a phrase moves with the harmony rather than repeating the same pitches.

| Control | What it does |
| --- | --- |
| Density | How many steps play. Beats are more likely to play than off-beats |
| Leaps | The chance of a jump of several notes instead of a step |
| Rests | How often the melody falls silent, instead of playing or holding a note |

## MIDI

Each track sends its notes on its own USB MIDI channel: Dyad A on 1, Dyad B on 2, Bass on 3, Melody on 4. Set a track's output to MIDI only to drive an external synth instead of the FM-1's own sound. The FM-1's MENU > MIDI > MIDI IN setting moves all four to channels 5–8, 9–12 or 13–16, or lets you give each track its own channel.

On the web page, the MIDI out line shows the notes each channel is holding. Where the browser allows Web MIDI, a **Send to** menu appears there, and choosing a port sends the notes to that device.

MIDI CC 16, on any channel, turns the macro. Other incoming MIDI plays the tracks as it does in Felucca. MIDI in modes that steer the generator are planned.

## Tips

- **Slow harmony, busy parts:** set the master rate to 4 or 8 bars, raise the melody's density, and set dyad B to ×½ so it moves twice as often as the master.
- **One-knob build:** set the macro weights to Dyad A 30, Dyad B 60, Bass 20 and Melody 100, start the macro at −100 and bring it up over a few minutes, so the melody arrives last and the bass barely moves. Map it to a knob on a controller with CC 16.
- **Human feel:** give the melody a drift of about 30 and the bass 10, with a global swing of 20. For a looser, half-asleep feel, raise the global drift instead.
- **Loose loops:** freeze a melody you like and set its chance to about 70 %, so the phrase stays recognisable but drops different notes each time.
- **Breathing parts:** give the melody a Sine density mod over 8 bars and the dyads a Square over 4, so the parts take turns being busy.
- **Shifting patterns:** give the melody 5 or 7 steps and the bass 12, so the parts line up differently every bar.
- **A phrase that evolves:** keep mutation around 10. Freeze the melody when you hear a phrase you like.
- **Ambient drone:** choose Pedal, set the master rate to 16 bars, give both dyads Sustain with low density, and turn the melody's rests up.
- **Drive other gear:** set every track's output to MIDI only and connect the FM-1 (or the web page's Send to) to your synths.

## Limits of this version

- No controls on the FM-1's own screen yet. Settings are made on the web page.
- Settings are not saved with Felucca projects yet. Switching the generator on starts from the defaults above.
- Not yet tested on a real FM-1.
