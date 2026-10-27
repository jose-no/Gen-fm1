# Gen-FM1 manual

Gen-FM1 turns the FM-1 into four generative tracks that play together in one key. Every setting can be made in two places: on the FM-1 itself (its screen, knobs and keys) and on the control page, a web page that talks to the FM-1 over USB. The two stay in step: turn a knob on the FM-1 and the page moves; change something on the page and the FM-1's screen shows it. Everything else on the FM-1 (the panel, the screen, the SEQ page, MIDI in) works as in [Felucca](https://github.com/hugelton/Felucca/wiki).

## Getting started

1. Switch the FM-1 on. The generator starts with it, with a new setup drawn at random: key, scale, tempo, progression, and each track's sound, rhythm and density (see [Random setups](#random-setups)).
2. Press **PLAY**.
3. Press **ARP** to reach the generator's pages, and turn the knobs while it plays. Changes take effect from the next step.

The generator can be switched off on the FM-1 (SAVE > POWER ON, KNOB 4) or with the control page's **On** button. Off stops playback and the generator; the patterns it last wrote stay and play like any Felucca pattern. At the next power-on it starts again.

## On the FM-1

The generator's pages replace ARP's while the generator runs. Each page shows four settings, one per knob, as Felucca's pages do; turn a knob to change its setting.

**ARP** (tap it again for the next page):

| Page | KNOB 1 | KNOB 2 | KNOB 3 | KNOB 4 |
| --- | --- | --- | --- | --- |
| GEN 1 | Key | Scale | Progression source | Chords in the loop |
| GEN 2 | Master rate | Mutation | Macro | Dyad B mode |
| GEN 3 | Drift (all) | Swing (all) | Preset | Tuning (432 / 440) |
| TRACK 1 | Sound | Interval, pattern or note pool | Rhythm (dyads) or leaps (melody) | Density |
| TRACK 2 | Length | Chord rate | Harmony lock | Octave |
| TRACK 3 | Chance | Drift | Swing | Macro weight |
| TRACK 4 | Density mod | Mod rate | Mod depth | Rests (melody) |
| TRACK 5 | Output | Freeze | Mute | |

GEN pages show the progression loop with the chord playing now, and each track's chord under its knob. TRACK pages work on the selected track: **ALGORITHM** picks it, as on every Felucca page. Their screen shows the track's pattern as the generator writes it (press PLAY to see it move).

**Hold ARP** for the quick layer: the keys pick the key (F3 to E4 give F to E), KNOBS 1–4 set key, scale, mutation and macro, **OCT+** draws a new random setup, and **OCT−** puts back the setup you had when you opened the layer. The map shows which notes are in the scale and the progression in Roman numerals. Let go of ARP to close it.

**SAVE** (after Felucca's own USER, PRESETS, PHRASES, PROJECT and TOOLS pages):

| Page | What it does |
| --- | --- |
| SETUPS | KNOB 1 picks a slot (1–8); the grid shows which hold a setup and which one power-on starts from. KNOB 2, 3 or 4 picks CLEAR, LOAD or SAVE, and **OCT+** does it. Clear and Save over a used slot ask first |
| POWER ON | KNOB 1: what power-on does (RAND, LAST, or SET 1–8). KNOB 2 picks RANDOM (a new setup now) and KNOB 3 DEFAULTS (asks first); **OCT+** does it. KNOB 4 switches the generator on or off |

The custom scale's notes and the "New progression" button are on the control page only.

## Control page

The control page has every setting, laid out on one screen, and talks to the FM-1 over its USB cable. Open it in Chrome or Edge on a computer (they have Web MIDI; Safari and Firefox on iOS don't).

1. Connect the FM-1 to the computer with USB.
2. Open the control page and press **Connect FM-1**. The browser asks to allow MIDI with SysEx: allow it.
3. The page reads every setting from the FM-1 and shows them. From then on:
   - a change on the page goes to the FM-1 straight away;
   - a change on the FM-1 (a knob, the ARP layer, RANDOM, a setup loaded, MIDI CC 16) shows on the page within a moment;
   - the transport, the chords playing and each track's notes show live.

**Disconnect** stops the link; the FM-1 carries on playing. If the cable comes out, the page says so: plug it back in and press Connect FM-1 again.

No FM-1 to hand? **Virtual FM-1** runs the same firmware inside the page, with its screen, knobs and keys, and links the panel to it the same way.

The page needs the FM-1 to run Gen-FM1: plain Felucca doesn't answer the generator's messages, and the page says so. Use one page at a time with the FM-1: Felucca's own web editor talks over the same USB link.

## Random setups

Every power-on draws a new setup, so the FM-1 starts somewhere different each time. The draw stays within ranges that suit each part:

- **Tempo** 84–120 BPM, **key** any of the 12, **scale** mostly major, minor and the modes, with some pentatonic and harmonic minor. Chromatic, whole tone, diminished and blues are never drawn.
- **Progression** any source, 3 to 8 chords (most often 4), changing every ½ to 8 bars. **Mutation** 5–40.
- **Sounds that suit the part:** the dyads draw from Tine EP, Bell, Brass, Pad and Organ; the bass from FM Bass (most often), Marimba and Pluck; the melody from Pluck, Bell, Marimba, Tine EP and Brass.
- **Densities** 25–75. About half the tracks get a density mod; a quarter get an odd length (5–14 steps); a third get some drift or a chance below 100 %. The bass is usually locked to the master chords.
- **Not drawn:** each track's output (synth, MIDI or both) stays as you set it, and freeze, mute and the macro start off.

On the control page, **Randomize** draws a new setup at any time, even while it plays, and **Defaults** returns to the settings this manual lists. On the FM-1, hold ARP and press OCT+, or use SAVE > POWER ON > RANDOM. To keep a setup you like, save it (next section).

## Saving setups

The FM-1 keeps 8 setups (on the FM-1: SAVE > SETUPS; on the control page: the setups row). A setup is everything the generator plays from: every setting on the page, the progression as it stands, the custom scale, the tempo and swing, and the patterns of any frozen tracks, so a phrase you froze comes back note for note.

| Control | What it does |
| --- | --- |
| 1–8 | Pick a slot. A dot marks a slot that holds a setup; a green ring marks the one power-on starts from |
| Save | Saves what plays now into the slot, replacing what was there |
| Load | Plays from the slot's setup straight away, even while playing |
| Clear | Empties the slot. Press it twice: the first press asks |
| At power-on | **New random setup** (the default), **Resume last session** (everything as it was when you last stopped), or **Setup 1–8** (always start from that setup) |

**When it is stored.** Writing to the FM-1's memory briefly pauses the chip, so, like Felucca's own settings, saves are only written while nothing plays. A save made during playback is kept and written 1.5 seconds after you stop. The line beside the controls says when it's stored. With **Resume last session**, your changes are kept the same way, each time playback stops.

Setups are kept in the same flash record as Felucca's own settings, which has two copies, so a power cut while saving cannot lose them. If you ever reinstall plain Felucca, it won't recognise the larger record and will reset its own display preferences once. Your setups are only lost if Felucca then saves its settings over them.

With the Virtual FM-1, setups are kept in your browser, as Felucca's web page keeps its saves.

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
| Tuning | A = 432 Hz or A = 440 Hz | The pitch every track is tuned to. 432 is the default. It belongs to the instrument, not to a setup: Randomize, Defaults and loading a setup leave it alone, and the FM-1 keeps it through power-off (see below) |
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

## Tuning

Gen-FM1 tunes to A = 432 Hz unless you choose 440. It uses Felucca's master tune (MENU > AUDIO > TUNE on the FM-1), set to −32 cents: A sounds at 431.94 Hz, as close to 432 as the FM engine's fine pitch steps allow, a quarter of a cent away. Felucca's MENU > TUNE still works for the session, and the generator's choice applies again at the next power-on.

**External synths.** MIDI notes carry no tuning. A synth you drive from the FM-1's MIDI out plays at its own tuning, so set it to A = 432 Hz too (often called master tune or calibration), or it will sound 32 cents apart from the FM-1.

## MIDI

Each track sends its notes on its own USB MIDI channel: Dyad A on 1, Dyad B on 2, Bass on 3, Melody on 4. Set a track's output to MIDI only to drive an external synth instead of the FM-1's own sound. The FM-1's MENU > MIDI > MIDI IN setting moves all four to channels 5–8, 9–12 or 13–16, or lets you give each track its own channel.

On the control page, the MIDI out line shows the notes each channel is holding. Where the browser allows Web MIDI, a **Send to** menu appears there, and choosing a port sends the notes to that device.

MIDI CC 16, on any channel, turns the macro. Other incoming MIDI plays the tracks as it does in Felucca. MIDI in modes that steer the generator are planned.

## Tips

- **Slow harmony, busy parts:** set the master rate to 4 or 8 bars, raise the melody's density, and set dyad B to ×½ so it moves twice as often as the master.
- **One-knob build:** set the macro weights to Dyad A 30, Dyad B 60, Bass 20 and Melody 100, start the macro at −100 and bring it up over a few minutes, so the melody arrives last and the bass barely moves. Map it to a knob on a controller with CC 16.
- **Human feel:** give the melody a drift of about 30 and the bass 10, with a global swing of 20. For a looser, half-asleep feel, raise the global drift instead.
- **Keep a good accident:** when a random power-on lands somewhere you like, press Save. Set At power-on to that setup to start there every time, or leave it on random and Load it when you want it.
- **Loose loops:** freeze a melody you like and set its chance to about 70 %, so the phrase stays recognisable but drops different notes each time.
- **Breathing parts:** give the melody a Sine density mod over 8 bars and the dyads a Square over 4, so the parts take turns being busy.
- **Shifting patterns:** give the melody 5 or 7 steps and the bass 12, so the parts line up differently every bar.
- **A phrase that evolves:** keep mutation around 10. Freeze the melody when you hear a phrase you like.
- **Ambient drone:** choose Pedal, set the master rate to 16 bars, give both dyads Sustain with low density, and turn the melody's rests up.
- **Drive other gear:** set every track's output to MIDI only and connect the FM-1 (or the web page's Send to) to your synths.

## Limits of this version

- The generator replaces the patterns Felucca kept from its last session at every power-on; the generator's own setups are kept as described in [Saving setups](#saving-setups).
- Not yet tested on a real FM-1.
